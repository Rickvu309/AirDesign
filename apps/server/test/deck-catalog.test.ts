import {initializeAccountDeletion} from "../src/account/deletion-store.ts"
import {writeSavedPptx} from "../../../packages/pptx/src/export-deck.ts"
import {PGlite} from "@electric-sql/pglite"
import {createCatalog,initializeCatalog} from "../../../packages/catalog/src/index.ts"
import {importPptx} from "../../../packages/pptx/src/index.ts"
import {importedDeck} from "../../../packages/pptx/src/import-deck.ts"
import {welcomeDeck} from "../../../packages/catalog/src/welcome-deck.ts"
import { it,expect } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { commandId,initialHistory } from "../../../packages/change-log/src/index.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { purgeExpiredDecks } from "../../worker/src/purge/expired-decks.ts"

it("upgrades an existing catalog without losing decks and preserves stars when initialization repeats",async()=>{
  const database=new PGlite(),owner={personId:"owner"},deck=fixtureDeck(1)
  try{
    await database.query("CREATE TABLE editing_deck(id text PRIMARY KEY,owner text NOT NULL,state jsonb NOT NULL,deleted boolean NOT NULL DEFAULT false,title text NOT NULL,updated_at double precision NOT NULL)")
    await database.query("INSERT INTO editing_deck(id,owner,state,title,updated_at) VALUES($1,$2,$3,$4,$5)",[deck.id,owner.personId,initialHistory(deck),"Existing proposal",1234])
    await initializeAccountDeletion(database)
    await initializeCatalog(database)
    const catalog=createCatalog(work=>database.transaction(work))
    expect((await catalog.list(owner)).map(({title,starred,created})=>({title,starred,created}))).toEqual([{title:"Existing proposal",starred:false,created:1234}])
    await catalog.star(owner,deck.id,true)
    await initializeCatalog(database)
    expect((await catalog.details(owner,deck.id)).starred).toBe(true)
    expect((await catalog.details(owner,deck.id)).preview?.slide).toEqual(deck.slides[0])
  }finally{await database.close()}
})

it("persists pending requests, owned search, rename and independent copies",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"},other={personId:"other"}
  try {
    expect(await store.catalog.list(owner)).toEqual([])
    const [first,retry]=await Promise.all([store.catalog.create(owner,"create","Growth","Keep my first request"),store.catalog.create(owner,"create","Growth","Keep my first request")])
    expect(first).toEqual(retry)
    expect((await store.catalog.details(owner,first.id)).pendingRequest).toBe("Keep my first request")
    expect((await store.read(owner,first.id)).deck.slides).toEqual([])
    await expect(store.catalog.create(owner,"create","Other")).rejects.toThrow("request-id-payload-conflict")
    await expect(store.catalog.details(other,first.id)).rejects.toThrow("deck-not-found")
    const deck=fixtureDeck(2),copy=await store.catalog.create(owner,"copy","Source copy","",deck)
    expect(copy.id).not.toBe(deck.id)
    await store.commit(owner,copy.id,{id:commandId("copy_edit"),kind:"patch",base:0,run:null,target:deck.slides[0]!.id,fields:{notes:"searchable forecast"}})
    expect((await store.catalog.list(owner,false,"FORECAST")).map(row=>row.id)).toEqual([copy.id])
    expect(await store.catalog.list(owner,false,"%_")).toEqual([])
    await store.catalog.rename(owner,copy.id,"Board review")
    expect((await store.catalog.details(owner,copy.id)).title).toBe("Board review")
    expect(deck.slides[0]?.notes).toBe("Canonical render fixture")
    expect((await store.read(owner,copy.id)).seq).toBe(1)
  }finally{await store.close()}
})
it("restores history before expiry and purges only expired Trash exactly once",async()=>{
  let now=1000
  const store=await createHistoryStore({kind:"pglite"},()=>now),owner={personId:"owner"},other={personId:"other"}
  try {
    const deck=fixtureDeck(2),entry=await store.catalog.create(owner,"trash","Trash me","",deck)
    const edit={id:commandId("preserved"),kind:"patch",base:0,run:null,target:deck.slides[0]!.id,fields:{notes:"preserved history"}} satisfies Parameters<typeof store.commit>[2]
    await store.commit(owner,entry.id,edit)
    const snapshot=await store.read(owner,entry.id)
    await store.catalog.trash(owner,entry.id)
    await expect(store.commit(owner,entry.id,{...edit,id:commandId("blocked")})).rejects.toThrow("deck-deleted")
    expect((await store.catalog.readDeleted(owner,entry.id)).deck).toEqual(snapshot.deck)
    expect(await store.catalog.list(owner)).toEqual([])
    expect((await store.catalog.list(owner,true))).toHaveLength(1)
    now+=30*86400000-1
    expect(await purgeExpiredDecks(store.catalog)).toEqual({removed:[]})
    await store.catalog.restore(owner,entry.id)
    expect(await store.read(owner,entry.id)).toEqual(snapshot)
    await store.catalog.trash(owner,entry.id)
    now+=30*86400000
    const fresh=await store.catalog.create(other,"fresh","Fresh trash")
    await store.catalog.trash(other,fresh.id)
    await expect(store.catalog.restore(owner,entry.id)).rejects.toThrow("deck-expired")
    const results=await Promise.all([purgeExpiredDecks(store.catalog),purgeExpiredDecks(store.catalog)])
    expect(results.flatMap(result=>result.removed)).toEqual([entry.id])
    await expect(store.catalog.readDeleted(owner,entry.id)).rejects.toThrow("deck-not-found")
    expect((await store.catalog.list(other,true)).map(row=>row.id)).toEqual([fresh.id])
    expect(await store.catalog.emptyTrash(owner,[])).toEqual([])
  }finally{await store.close()}
})

it("persists owned stars without changing edit order, keeps creation time and supplies real native previews",async()=>{
  let now=1000
  const store=await createHistoryStore({kind:"pglite"},()=>now),owner={personId:"owner"},other={personId:"other"}
  try{
    const deck=fixtureDeck(2),entry=await store.catalog.create(owner,"starred","Native","",deck)
    now=2000
    const newer=await store.catalog.create(owner,"newer","Newer")
    await store.catalog.star(owner,entry.id,true)
    expect((await store.catalog.details(owner,entry.id)).starred).toBe(true)
    expect((await store.catalog.list(owner)).map(row=>row.id)).toEqual([newer.id,entry.id])
    expect((await store.catalog.details(owner,entry.id)).created).toBe(1000)
    expect((await store.catalog.details(owner,entry.id)).preview).toEqual({slide:deck.slides[0],themes:deck.themes})
    expect(newer.preview).toBeNull()
    await expect(store.catalog.star(other,entry.id,false)).rejects.toThrow("deck-not-found")
    await store.catalog.trash(owner,entry.id)
    expect((await store.catalog.list(owner)).some(row=>row.starred)).toBe(false)
    await store.catalog.restore(owner,entry.id)
    expect((await store.catalog.list(owner)).find(row=>row.id===entry.id)?.starred).toBe(true)
    await store.catalog.star(owner,entry.id,false)
    expect((await store.catalog.details(owner,entry.id)).starred).toBe(false)
  }finally{await store.close()}
})

it("supplies imported first-slide content and creates a real welcome proposal",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"}
  try{
    const deck=fixtureDeck(2),bytes=await writeSavedPptx(deck,0,null,{}),imported=importedDeck(await importPptx(bytes))
    const retained=await store.catalog.create(owner,"import_preview","Imported","",imported,{bytes,report:{}})
    expect(retained.preview).toEqual({slide:imported.slides[0],themes:imported.themes})
    expect(retained.preview?.slide.elements.some(element=>element.kind==="text"&&element.runs.some(run=>run.text==="A clear direction"))).toBe(true)
    const welcome=await store.catalog.create(owner,"welcome","Welcome to AirDesign","",welcomeDeck())
    expect(welcome.slides).toBe(3)
    expect(welcome.preview?.slide.elements.some(element=>element.kind==="text"&&element.runs.some(run=>run.text==="A clear proposal. A confident decision."))).toBe(true)
  }finally{await store.close()}
})

import { it,expect } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { purgeExpiredDecks } from "../../worker/src/purge/expired-decks.ts"

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

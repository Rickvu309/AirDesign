import { it,expect } from "vitest"
import { createHistoryStore } from "../src/db/history-store.ts"
import { fixtureDeck } from "../../../packages/deck/src/fixture.ts"
import { exportFilename } from "../src/decks/export-filename.ts"
import { commandId } from "../../../packages/change-log/src/index.ts"

it("purges only confirmed owned deletion generations across tabs",async()=>{
  let now=1000
  const store=await createHistoryStore({kind:"pglite"},()=>now),owner={personId:"owner"},other={personId:"other"}
  try{
    const first=await store.catalog.create(owner,"first","First"),later=await store.catalog.create(owner,"later","Later"),foreign=await store.catalog.create(other,"foreign","Foreign")
    const confirmed=await store.catalog.trash(owner,first.id)
    await store.catalog.trash(owner,later.id)
    await store.catalog.trash(other,foreign.id)
    await store.catalog.restore(owner,first.id)
    now++
    await store.catalog.trash(owner,first.id)
    expect(await store.catalog.emptyTrash(owner,[confirmed,{...foreign,generation:1}])).toEqual([])
    expect((await store.catalog.list(owner,true))).toHaveLength(2)
    expect(await store.catalog.emptyTrash(owner,await store.catalog.list(owner,true))).toHaveLength(2)
    expect(await store.catalog.list(other,true)).toHaveLength(1)
  }finally{await store.close()}
})
it("restoring a trashed deck never revives a run or its credential",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"}
  try{
    const entry=await store.catalog.create(owner,"run","Run","",fixtureDeck(1))
    await store.commit(owner,entry.id,{id:commandId("start"),kind:"start-run",run:"old"})
    const token=await store.issueRunToken(owner,entry.id,"old")
    const identity=await store.runIdentity(owner,entry.id,token)
    await store.catalog.trash(owner,entry.id)
    await store.catalog.restore(owner,entry.id)
    await expect(store.runIdentity(owner,entry.id,token)).rejects.toThrow("invalid-run-credential")
    const result=await store.commit(owner,entry.id,{id:commandId("late"),kind:"patch",base:1,run:"old",target:fixtureDeck(1).slides[0]!.id,fields:{notes:"late"}},identity)
    expect(result.kind).toBe("refused")
  }finally{await store.close()}
})
it("retains both formats for the owner across tabs and captures the export title",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"}
  try{
    const entry=await store.catalog.create(owner,"deck","Before","",fixtureDeck(1))
    await store.catalog.rename(owner,entry.id,"Board / Q4")
    const options={slides:[],timing:"now",expectedSeq:0,allowIssues:true} as const
    const first=await store.exports.submit(owner,"pptx",entry.id,{...options,slides:[],format:"pptx"})
    const second=await store.exports.submit(owner,"pdf",entry.id,{...options,slides:[],format:"pdf"})
    expect((await store.exports.list(owner,entry.id)).map(job=>job.id).sort()).toEqual([first.id,second.id].sort())
    expect(await store.exports.list({personId:"other"},entry.id)).toEqual([])
    await store.catalog.rename(owner,entry.id,"After submission")
    const claim=await store.exports.claim()
    expect(claim?.snapshot.title).toBe("Board / Q4")
  }finally{await store.close()}
})

it("names artifacts from the sanitized title captured before later renames",async()=>{
  const store=await createHistoryStore({kind:"pglite"}),owner={personId:"owner"}
  try{
    const entry=await store.catalog.create(owner,"title","Before","",fixtureDeck(1))
    await store.catalog.rename(owner,entry.id,'Board / "Q4"')
    const job=await store.exports.submit(owner,"title_export",entry.id,{slides:[],timing:"now",expectedSeq:0,allowIssues:true,format:"pptx"})
    await store.catalog.rename(owner,entry.id,"After")
    const claim=await store.exports.claim()
    expect(claim?.snapshot.title).toBe('Board / "Q4"')
    await store.exports.complete(job.id,claim!.lease,Buffer.from("artifact"),{})
    const artifact=await store.exports.artifact(owner,job.id)
    expect(exportFilename(artifact.title,artifact.seq,artifact.format)).toBe("Board _ _Q4_-v0.pptx")
  }finally{await store.close()}
})

import {PGlite} from "@electric-sql/pglite"
import {expect,it} from "vitest"
import {initializeToolSnapshots,toolSnapshots,textResult} from "../src/snapshots.ts"
it("gives remote agents an explicit success or actionable failure envelope",()=>{
  expect(JSON.parse(textResult({savedVersion:4}).content[0]!.text)).toEqual({ok:true,data:{savedVersion:4}})
  const error=JSON.parse(textResult({code:"stale-base",savedVersion:4},true).content[0]!.text)
  expect(error).toMatchObject({ok:false,error:{code:"stale-base",retryable:false,details:{savedVersion:4}}})
  expect(error.error.recovery).toContain("rebase")
})
it("bounds UTF-8 envelopes and binds frozen cursors and subtree resources to their owner, query and expiry",async()=>{
  const database=new PGlite();let now=0
  await initializeToolSnapshots(database)
  const snapshots=toolSnapshots(work=>database.transaction(work),()=>now)
  const load=async()=>({items:[{id:"large",text:"雪".repeat(10000)},{id:"small"},{id:"last"}],meta:{version:0}})
  const value=(result:{content:{text:string}[]})=>JSON.parse(result.content[0]!.text).data
  try{
    const first=await snapshots.page("owner","get_slide",{limit:1},load),page=value(first)
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(20000)
    expect(page.items[0].resource).toContain("airdesign://snapshots/")
    expect(await snapshots.resource("owner",page.snapshot)).toEqual(await load())
    await expect(snapshots.resource("other",page.snapshot)).rejects.toThrow("resource-not-found")
    const next=value(await snapshots.page("owner","get_slide",{limit:1,cursor:page.nextCursor},async()=>{throw new Error("must-use-frozen-data")}))
    expect(next.items).toEqual([{id:"small"}])
    for(const [owner,tool,args] of [["other","get_slide",{limit:1}],["owner","get_deck",{limit:1}],["owner","get_slide",{limit:2}]] as const)await expect(snapshots.page(owner,tool,{...args,cursor:page.nextCursor},load)).rejects.toThrow("invalid-or-expired-cursor")
    now=15*60000
    await expect(snapshots.page("owner","get_slide",{limit:1,cursor:page.nextCursor},load)).rejects.toThrow("invalid-or-expired-cursor")
    await expect(snapshots.resource("owner",page.snapshot)).rejects.toThrow("resource-not-found")
  }finally{await database.close()}
})

it("preserves typed pause retry semantics in the public tool envelope",()=>{
  expect(JSON.parse(textResult({kind:"refused",code:"editing-paused",retryable:true,next:"retain-and-retry"},true).content[0]!.text)).toMatchObject({ok:false,error:{retryable:true,details:{next:"retain-and-retry"}}})
})

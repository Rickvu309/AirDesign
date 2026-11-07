import {expect,it} from "vitest"
import {operationTracker,safeReason} from "../../scripts/live/operation-trace.ts"

const json="application/json; charset=utf-8",never=()=>new Promise<unknown>(()=>undefined)

it("returns the failed reason within the settle window when a later body never completes",async()=>{
  const tracker=operationTracker(50)
  tracker.begin()
  tracker.observe("GET","/api/catalog/export-jobs/job-1/retry",json,async()=>({id:"job-1",kind:"failed",reason:"worker-retry-exhausted",attempts:3}))
  await Promise.resolve()
  tracker.observe("GET","/api/operations/job-2",json,never)
  const started=Date.now(),traces=await tracker.settled()
  expect(Date.now()-started).toBeLessThan(1000)
  expect(traces).toEqual([{id:"job-1",kind:"failed",reason:"worker-retry-exhausted",attempts:3}])
})

it("does not let a stalled read from an earlier step delay or leak into the next step",async()=>{
  const tracker=operationTracker(5000)
  tracker.begin()
  tracker.observe("GET","/api/operations/old",json,never)
  tracker.begin()
  tracker.observe("GET","/api/operations/new",json,async()=>({id:"new",kind:"failed",reason:"deliberate-export-failure"}))
  const started=Date.now(),traces=await tracker.settled()
  expect(Date.now()-started).toBeLessThan(1000)
  expect(traces).toEqual([{id:"new",kind:"failed",reason:"deliberate-export-failure"}])
})

it("keeps only the latest state per operation and drops payload fields outside the trace",async()=>{
  const tracker=operationTracker(50)
  tracker.begin()
  tracker.observe("GET","/api/catalog/deck-1/exports",json,async()=>[{id:"a",kind:"running",sha256:"f".repeat(64),report:{secret:"x"},url:"https://store.example/a.pptx"},{id:"b",kind:"queued"}])
  await Promise.resolve()
  tracker.observe("GET","/api/operations/a",json,async()=>({id:"a",kind:"failed",reason:"render-timeout",attempts:2,lease:"lease-secret"}))
  expect(await tracker.settled()).toEqual([{id:"b",kind:"queued"},{id:"a",kind:"failed",reason:"render-timeout",attempts:2}])
})

it("ignores writes, non-JSON, unrelated routes, unknown kinds and malformed ids",async()=>{
  const tracker=operationTracker(50),body=async()=>({id:"x",kind:"failed",reason:"r"})
  tracker.begin()
  tracker.observe("POST","/api/operations/x",json,body)
  tracker.observe("GET","/api/operations/x","text/html",body)
  tracker.observe("GET","/api/account",json,body)
  tracker.observe("GET","/api/operations/y",json,async()=>({id:"y",kind:"exploded"}))
  tracker.observe("GET","/api/operations/z",json,async()=>({id:"z/../../etc",kind:"failed"}))
  tracker.observe("GET","/api/operations/w",json,async()=>{throw new SyntaxError("bad json")})
  expect(await tracker.settled()).toEqual([])
})

it("redacts credentials, artifact URLs and digests from operation reasons",()=>{
  const reason=safeReason("upload failed Authorization: Bearer abc.def.ghi\nCookie: session=s3cr3t; theme=dark token: tok123 api_key=k9 at https://store.example/export/secret.pptx?token=t digest "+"ab".repeat(32)+" blob "+"Zm9vYmFy1234567890Zm9vYmFy1234567890")
  for(const leaked of ["abc.def.ghi","s3cr3t","tok123","k9","store.example","secret.pptx","ab".repeat(32),"Zm9vYmFy1234567890"])expect(reason).not.toContain(leaked)
  expect(reason).toContain("upload failed")
  expect(reason.length).toBeLessThanOrEqual(200)
})

it("keeps ordinary operation reasons readable",()=>{
  for(const reason of ["worker-retry-exhausted","deliberate-export-failure","render-timeout-after-three-attempts-on-slide-twelve","PDF deadline exceeded after 60 seconds"])expect(safeReason(reason)).toBe(reason)
})

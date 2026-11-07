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

it("keeps only the reason code and omits every free-text detail",()=>{
  const leaks:[string,string][]=[
    ["upload failed Authorization: Bearer abc.def.ghi","unclassified (details omitted)"],
    ['export-failed {"api_key":"k9","token":"tok123"}',"export-failed (details omitted)"],
    ["isolated-export-failed:1:artifact //store.example/export/private.pptx?sig=abc","isolated-export-failed:1 (details omitted)"],
    ["isolated-worker-failed:null:digest XUFAKrxLKna5cZ2REBfFkg==","isolated-worker-failed:null (details omitted)"],
    ["sk-abc123def456","unclassified (details omitted)"],
    ["Cookie: session=s3cr3t","unclassified (details omitted)"],
    ["https://store.example/a.pptx?token=t","unclassified (details omitted)"],
  ]
  for(const [reason,expected] of leaks)expect(safeReason(reason)).toBe(expected)
})

it("keeps every real operation reason code readable",()=>{
  for(const reason of ["worker-retry-exhausted","worker-failed","worker-restarted","report-limit","invalid-worker-report","export-failed","export-report-limit","invalid-export-report","invalid-saved-version","invalid-slide-range","font-hash-mismatch","export-needs-review","empty-export","mixed-slide-sizes-require-fix","pinned-fonts-unavailable","deliberate-export-failure"])expect(safeReason(reason)).toBe(reason)
  expect(safeReason("isolated-export-failed:137:")).toBe("isolated-export-failed:137")
})

it("records a failed operation without a reason as unclassified and never gives other kinds a reason",async()=>{
  const tracker=operationTracker(50)
  tracker.begin()
  tracker.observe("GET","/api/operations/f",json,async()=>({id:"f",kind:"failed"}))
  tracker.observe("GET","/api/operations/r",json,async()=>({id:"r",kind:"running",reason:"Bearer leaked"}))
  expect(await tracker.settled()).toEqual([{id:"f",kind:"failed",reason:"unclassified (details omitted)"},{id:"r",kind:"running"}])
})

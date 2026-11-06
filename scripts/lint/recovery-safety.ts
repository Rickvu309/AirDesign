export function recoverySafetyHits(file:string,source:string){
  const normalized=file.replaceAll("\\","/"),hits:{line:number;reason:string}[]=[]
  const reject=(reason:string)=>hits.push({line:1,reason})
  if(normalized.endsWith(".test.ts")&&/expect\([^\n]*pg_stat_activity[^\n]*\)\.toBe\((?:0|"0")\)/.test(source))reject("prove-postgres-release-with-unforced-drop-not-immediate-backend-count")
  if(normalized.endsWith("/vitest.config.ts")&&!source.includes("maxWorkers: Number(process.env.VITEST_MAX_WORKERS ?? 2)"))reject("bound-test-workers-to-heavy-memory-budget")
  if(normalized.endsWith("/packages/access/src/create-access.ts")){
    const start=source.indexOf("async function deleteAccount("),end=source.indexOf("async function readPerson(",start),deletion=source.slice(start,end)
    if(deletion.includes("await options.deleteOwnedData?.(user.id)"))reject("persist-deletion-job-and-revoke-sessions-before-owned-purge")
    if(!source.includes("tables.deletion"))reject("account-deletion-needs-durable-auth-cleanup-job")
  }
  if(normalized.endsWith("/apps/server/src/agent/handle.ts")){
    const resume=source.split('\n').find(line=>line.includes('body.action==="resume"')) ?? ""
    if(!resume.includes('kind==="stopped"')||!resume.includes('kind==="limited"'))reject("resume-failed-stopped-and-limited-runs")
    const stop=source.split('\n').find(line=>line.includes("async function stop(live:")) ?? ""
    if(stop.includes("closeRun"))reject("stop-preserves-history-run-for-resume")
  }
  if(normalized.endsWith("/packages/agent/src/local-adapter.ts")&&source.includes('throw new Error("change-refused")')&&!source.includes("UsageLimitError"))reject("preserve-typed-usage-limit-before-generic-tool-refusal")
  if(normalized.endsWith("/apps/server/src/main.ts")&&!source.includes("client:memory"))reject("share-memory-database-during-server-bootstrap")
  if(normalized.endsWith("/apps/studio/src/access/access-app.test.tsx")&&!source.includes('beforeEach(()=>{vi.stubGlobal("fetch"'))reject("access-workspace-tests-need-fetch-fixture")
  if(normalized.endsWith("/apps/server/src/rpc/websocket.ts") && /store\.commitSnapshot\(/.test(source))reject("batch-reconnect-admission-and-snapshot-instead-of-per-command-transactions")
  if(normalized.endsWith("/packages/rpc/src/client.ts") && source.slice(source.indexOf("private async send(")).includes("await this.outbox.read(this.key)"))reject("coalesce-concurrent-outbox-reads-under-command-locks")
  return hits
}

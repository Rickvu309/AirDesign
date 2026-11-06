import {expect,it} from "vitest"
import {execFileSync} from "node:child_process"
import {readFileSync} from "node:fs"
import {recoverySafetyHits} from "../../scripts/lint/recovery-safety.ts"
it.each(["packages/access/src/create-access.ts","apps/server/src/agent/handle.ts","packages/agent/src/local-adapter.ts","apps/server/src/main.ts","apps/studio/src/access/access-app.test.tsx","vitest.config.ts","apps/server/test/history-postgres.test.ts","apps/server/test/commands-authenticated.test.ts"])("rejects original recovery mistake and accepts the fix in %s",file=>{
  const original=execFileSync("git",["show",`accaae1:${file}`],{encoding:"utf8"})
  expect(recoverySafetyHits(`/repo/${file}`,original).length).toBeGreaterThan(0)
  expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

it("rejects the measured per-command sync recovery path and accepts batched admission",()=>{
 const file="apps/server/src/rpc/websocket.ts"
 const original=execFileSync("git",["show",`26c883d:${file}`],{encoding:"utf8"})
 expect(recoverySafetyHits(`/repo/${file}`,original).map(hit=>hit.reason)).toContain("batch-reconnect-admission-and-snapshot-instead-of-per-command-transactions")
 expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

it("rejects the measured per-command full outbox read and accepts concurrent read coalescing",()=>{
 const file="packages/rpc/src/client.ts"
 const original=execFileSync("git",["show",`26c883d:${file}`],{encoding:"utf8"})
 expect(recoverySafetyHits(`/repo/${file}`,original).map(hit=>hit.reason)).toContain("coalesce-concurrent-outbox-reads-under-command-locks")
 expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

import {expect,it} from "vitest"
import {execFileSync} from "node:child_process"
import {readFileSync} from "node:fs"
import {recoverySafetyHits} from "../../scripts/lint/recovery-safety.ts"
it.each(["packages/access/src/create-access.ts","apps/server/src/agent/handle.ts","packages/agent/src/local-adapter.ts","apps/server/src/main.ts","apps/studio/src/access/access-app.test.tsx","vitest.config.ts"])("rejects original recovery mistake and accepts the fix in %s",file=>{
  const original=execFileSync("git",["show",`accaae1:${file}`],{encoding:"utf8"})
  expect(recoverySafetyHits(`/repo/${file}`,original).length).toBeGreaterThan(0)
  expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

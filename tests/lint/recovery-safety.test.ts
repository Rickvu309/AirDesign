import {expect,it} from "vitest"
import {readFileSync} from "node:fs"
import {z} from "zod"
import {recoverySafetyHits} from "../../scripts/lint/recovery-safety.ts"

const originals=z.array(z.object({file:z.string(),reason:z.string(),revision:z.string(),source:z.string()})).parse(JSON.parse(readFileSync(new URL("./fixtures/recovery-original-mistakes.json",import.meta.url),"utf8")))

it.each(originals)("rejects original $revision recovery mistake and accepts the fix in $file",({file,reason,source})=>{
 expect(recoverySafetyHits(`/repo/${file}`,source).map(hit=>hit.reason)).toContain(reason)
 expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

it.each(["apps/studio/src/editor/manual-editor.tsx","apps/server/src/rpc/websocket.ts","apps/server/src/commands/handle.ts"])("rejects raw production errors and accepts reviewed copy in %s",file=>{
  const original=execFileSync("git",["show",`de13aa9:${file}`],{encoding:"utf8"})
  expect(recoverySafetyHits(`/repo/${file}`,original).length).toBeGreaterThan(0)
  expect(recoverySafetyHits(`/repo/${file}`,readFileSync(file,"utf8"))).toEqual([])
})

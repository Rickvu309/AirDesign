import {it,expect} from "vitest"
import {readFileSync} from "node:fs"
import {execFileSync} from "node:child_process"
import {releaseRuntimeHits} from "../../scripts/lint/release-runtime.ts"
it("rejects original payment defaults and missing renderer startup checks and accepts the fixes",()=>{
  for(const file of ["apps/server/src/main.ts","apps/server/src/billing/reconcile.ts","apps/worker/src/main.ts","package.json"]){
    const original=execFileSync("git",["show",`f15c6ddac838be912b3f27510037ff5e2fe7d327:${file}`],{encoding:"utf8"})
    expect(releaseRuntimeHits(file,original)).not.toEqual([])
    expect(releaseRuntimeHits(file,readFileSync(file,"utf8"))).toEqual([])
  }
})

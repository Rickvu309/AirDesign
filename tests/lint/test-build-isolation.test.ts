import {it,expect} from "vitest"
import {sharedBuildOutputHits} from "../../packages/lint/src/test-build-isolation.ts"
it("rejects tests that rebuild an app into its shared dist folder",()=>{
 const original='execFileSync("npm",["run","build","--workspace=@airdesign/studio"],{stdio:"pipe"})'
 expect(sharedBuildOutputHits("tests/release/payment-surface.test.ts",original)).toHaveLength(1)
 expect(sharedBuildOutputHits("tests/release/payment-surface.test.ts",'execFileSync("npm",["run","build","--workspace=@airdesign/studio","--","--outDir",outDir,"--emptyOutDir"],{stdio:"pipe"})')).toEqual([])
 expect(sharedBuildOutputHits("scripts/gate/run.ts",original)).toEqual([])
})

import {it,expect} from "vitest"
import {releaseClaimHits} from "../../packages/lint/src/release-claims.ts"
it("rejects unsupported public claims and retired routes",()=>{
 for(const original of ["lossless export","works in PowerPoint","supported Claude",'<a href="/share/deck">'])expect(releaseClaimHits(original).length).toBeGreaterThan(0)
 expect(releaseClaimHits("PPTX export. PowerPoint acceptance pending. Not yet verified with Claude.")).toEqual([])
})

import {it,expect} from "vitest"
import {releaseClaimHits} from "../../packages/lint/src/release-claims.ts"
it("rejects unsupported public claims and retired routes",()=>{
 for(const original of ["lossless export","works in PowerPoint","supported Claude",'<a href="/share/deck">'])expect(releaseClaimHits(original).length).toBeGreaterThan(0)
 expect(releaseClaimHits("PPTX export. PowerPoint acceptance pending. Not yet verified with Claude.")).toEqual([])
})

it("rejects retired Studio entries and fake unfinished UI",()=>{
 for(const source of ["<button>Share</button>","<button>Present</button>",'const route="/share/old"',"fake drafting","coming soon"])expect(releaseClaimHits(source).length).toBeGreaterThan(0)
 expect(releaseClaimHits("<button>Export</button> Export saved PPTX")).toEqual([])
})

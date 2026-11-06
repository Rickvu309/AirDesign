import {it,expect} from "vitest"
import {releaseClaimHits,sandboxDependencyHits,productCaptureHits} from "../../packages/lint/src/release-claims.ts"
it("rejects unsupported public claims and retired routes",()=>{
 for(const original of ["lossless export","works in PowerPoint","supported Claude",'<a href="/share/deck">'])expect(releaseClaimHits(original).length).toBeGreaterThan(0)
 expect(releaseClaimHits("PPTX export. PowerPoint acceptance pending. Not yet verified with Claude.")).toEqual([])
})

it("keeps archived worker dependencies inside the sandbox root",()=>{
 const original='await symlink(path.resolve("node_modules"),path.join(source,"node_modules"),"dir")'
 expect(sandboxDependencyHits("bench/release/trunk-review.mjs",original)).toHaveLength(1)
 expect(sandboxDependencyHits("bench/release/trunk-review.mjs",'await cp("node_modules",path.join(source,"node_modules"),{recursive:true,verbatimSymlinks:true})')).toEqual([])
})

it("rejects a product before-capture that can show its opening placeholder",()=>{
 const original='await screenshot("review/studio-before.png")'
 expect(productCaptureHits("bench/release/product-review.mjs",original)).toHaveLength(1)
 expect(productCaptureHits("bench/release/product-review.mjs",'await wait(() => textContent.includes("Saved"));'+original)).toEqual([])
})

it("rejects retired Studio entries and fake unfinished UI",()=>{
 for(const source of ["<button>Share</button>","<button>Present</button>",'const route="/share/old"',"fake drafting","coming soon"])expect(releaseClaimHits(source).length).toBeGreaterThan(0)
 expect(releaseClaimHits("<button>Export</button> Export saved PPTX")).toEqual([])
})

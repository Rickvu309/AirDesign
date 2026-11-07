import {it,expect} from "vitest"
import {releaseClaimHits,publicAmountHits,retiredRouteHits,sandboxDependencyHits,productCaptureHits} from "../../packages/lint/src/release-claims.ts"
it("rejects unsupported public claims and retired routes",()=>{
 for(const original of ["lossless export","works in PowerPoint","supported Claude",'<a href="/share/deck">'])expect(releaseClaimHits(original).length).toBeGreaterThan(0)
 expect(releaseClaimHits("PPTX export.",[{id:"export",text:"PPTX export.",kind:"proven",receipt:"P03/report.md"}])).toEqual([])
})

it("treats browser chrome metadata as configuration, not public copy",()=>{
 const head='<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#ffffff">'
 expect(releaseClaimHits(head)).toEqual([])
 expect(releaseClaimHits('<meta name="description" content="Unlimited decks">')).toEqual(["unregistered-public-copy:Unlimited decks"])
 for(const disguised of [`<meta name="description" data-note=' name="theme-color"' content="Unlimited decks">`,`<meta property="og:description" data-note=' name="viewport"' content="Unlimited decks">`,'<meta name="description" name="theme-color" content="Unlimited decks">','<meta property="og:description" name="theme-color" content="Unlimited decks">','<meta itemprop="description" name="theme-color" content="Unlimited decks">','<meta content="Unlimited decks" name="theme-color" data-note=">" property="og:description">'])expect(releaseClaimHits(disguised),disguised).toEqual(["unregistered-public-copy:Unlimited decks"])
 for(const disguised of ["viewport","theme-color"]){
  expect(releaseClaimHits(`<meta name="description" data-name="${disguised}" content="Unlimited decks">`)).toEqual(["unregistered-public-copy:Unlimited decks"])
  expect(releaseClaimHits(`<meta property="og:description" data-name="${disguised}" content="Unlimited decks">`)).toEqual(["unregistered-public-copy:Unlimited decks"])
 }
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
 expect(retiredRouteHits("<button>Export</button> Export saved PPTX")).toEqual([])
})

it("rejects unregistered claim categories and paraphrases",()=>{
 for(const text of ["100% PowerPoint fidelity","Supports ChatGPT and Cursor","Fully screen-reader accessible","A usage reset consumes $15","Perfect fidelity in every deck","Connect with any vendor","Accessible to every screen reader","Reset for fifteen dollars"]){
  expect(releaseClaimHits(text)).not.toEqual([])
 }
})

it("requires evidence or an explicit unverified external gate for registered copy",()=>{
 const text="Vendor verified"
 expect(releaseClaimHits(text,[{id:"unproven",text,kind:"proven",receipt:""}])).not.toEqual([])
 expect(releaseClaimHits(text,[{id:"premature",text,kind:"blocked",gate:"X05"}])).not.toEqual([])
 expect(releaseClaimHits("Vendor unverified",[{id:"pending",text:"Vendor unverified",kind:"blocked",gate:"X05"}])).toEqual([])
 for(const amount of ["Reset for $15","Buy 100 credits","Includes 10,000 units"] )expect(publicAmountHits(amount)).not.toEqual([])
 expect(publicAmountHits("Includes {{allowance}} units for {{freePrice}}" )).toEqual([])
})

it("requires passed matrix evidence for an external claim",()=>{
 const text="Aira built in",claim={id:"aira-built-in",text,kind:"external-passed",gate:"X03",receipt:"P09/external/X03/results/report.md"} as const
 const matrix="| X03 | passed | P09/external/X03/results/report.md | Claude only |"
 expect(releaseClaimHits(text,[claim],matrix)).toEqual([])
 for(const invalid of ["",matrix.replace("passed","pending"),matrix.replace("X03","X04"),matrix.replace("report.md","other.md")])expect(releaseClaimHits(text,[claim],invalid)).not.toEqual([])
 expect(releaseClaimHits(text,[{...claim,receipt:"P03/report.md"}],matrix)).not.toEqual([])
})

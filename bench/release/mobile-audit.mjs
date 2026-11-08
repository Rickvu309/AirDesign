import {assertArtifactDownload} from "../design-parity/capture.mjs"
import {readArchive} from "../../packages/pptx/src/archive.ts"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {mobileAuditFailures} from "./mobile-audit-checks.ts"
import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import {preview} from "vite"
import {chromium} from "playwright"
import {scenario} from "../agent-account/fixture.mjs"

const target=process.argv[2] ?? "all"
assert.ok(["all","site","studio"].includes(target),"Expected all, site, or studio")
const evidence=process.env.MOBILE_EVIDENCE
const desktop=process.env.MOBILE_DESKTOP==="1",tablet=process.env.MOBILE_TABLET==="1"
assert.ok(!(desktop&&tablet),"Select one audit viewport")
const width=desktop?1440:tablet?768:390
const results=[]
const browser=await chromium.launch()
const context=await browser.newContext({viewport:{width,height:844},hasTouch:!desktop,isMobile:!desktop,deviceScaleFactor:desktop?1:3})
const page=await context.newPage()
async function audit(name){
 await page.evaluate(()=>document.fonts.ready)
 const failures=await page.evaluate(mobileAuditFailures,page.viewportSize().width)
 results.push({name,failures})
 if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,name+".png"),fullPage:true,animations:"disabled"})}
}
try{
 if(target!=="studio"){
  const server=await preview({root:"apps/site",configFile:false,preview:{host:"127.0.0.1",port:0}})
  try{const origin=server.resolvedUrls.local[0];for(const route of ["","pricing/","agents/","agents/claude/","agents/codex/","examples/","status/"]){await page.goto(origin+route);await audit("site-"+(route.replaceAll("/","-")||"home"))}}finally{await server.close()}
 }
 if(target!=="site"){
  process.env.NODE_ENV="test"
  const stack=await scenario({browserEnabled:true})
  try{
   const identity=await (await page.request.get(stack.origin+"/version")).json()
   assert.equal(identity.sha,process.env.AIRDESIGN_BUILD_SHA??identity.sha)
   assert.equal(identity.builtAt,process.env.AIRDESIGN_BUILD_TIME??identity.builtAt)
   results.push({name:"studio-build-identity",failures:[],identity})
   await page.goto(stack.origin);await page.locator(".ad-sign-in").waitFor();await audit("studio-sign-in")
   const owner=await stack.fixture.signIn("mobile-audit@example.com")
   await context.addCookies(owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:stack.origin}}))
   await stack.deck(owner,"mobile-audit-deck")
   await page.goto(stack.origin);await page.locator("article.deck-card").waitFor();await audit("studio-home")
   await page.goto(stack.origin+"/settings/account");await page.getByRole("button",{name:"Edit",exact:true}).waitFor();await audit("studio-settings");await page.getByRole("button",{name:"Edit",exact:true}).click();await page.getByRole("button",{name:"Save name",exact:true}).waitFor();await audit("studio-settings-edit")
   await page.goto(stack.origin+"/deck/mobile-audit-deck");await page.locator('[data-sync-state="saved"]').waitFor();await audit("studio-editor")
   const viewport=page.viewportSize()
   assert.ok(viewport)
   const positions=await page.evaluateHandle(()=>({x:scrollX,y:scrollY,items:[...document.querySelectorAll("*")].map(element=>({element,top:element.scrollTop,left:element.scrollLeft}))}))
   try{
    await page.getByRole("button",{name:"Export",exact:true}).click();await page.locator("dialog[open]").waitFor()
    assert.deepEqual(page.viewportSize(),viewport)
    await audit("studio-export")
    const response=page.waitForResponse(response=>response.url().includes("/exports")&&response.request().method()==="POST")
    await page.locator(".export-dialog").getByRole("button",{name:"Export",exact:true}).click()
    const job=await (await response).json(),lease=await stack.fixture.history.exports.claim()
    assert.ok(lease&&lease.id===job.id)
    const saved=lease.snapshot,expected=await writeSavedPptx(saved.deck,saved.seq,saved.source,saved.assets??{})
    assert.equal(await stack.fixture.history.exports.complete(lease.id,lease.lease,expected,{}),true)
    const proof=await assertArtifactDownload(page,expected)
    const parts=await readArchive(Buffer.from(expected))
    assert.ok(parts.has("[Content_Types].xml")&&parts.has("ppt/presentation.xml")&&parts.has("ppt/slides/slide1.xml"))
    await page.getByText(proof.requestedFilename+" downloaded",{exact:true}).waitFor()
    results.push({name:"studio-export-download",failures:[],...proof,pptxParts:parts.size,boundary:"controlled local completion of actual saved snapshot; real authenticated artifact and browser download"})
   }finally{
    await page.setViewportSize(viewport)
    await page.evaluate(saved=>{for(const {element,top,left} of saved.items)element.scrollTo({top,left,behavior:"instant"});window.scrollTo({left:saved.x,top:saved.y,behavior:"instant"})},positions)
    try{
     assert.deepEqual(page.viewportSize(),viewport)
     const restored=await page.evaluate(saved=>scrollX===saved.x&&scrollY===saved.y&&saved.items.every(({element,top,left})=>!element.isConnected||(element.scrollTop===top&&element.scrollLeft===left)),positions)
     assert.equal(restored,true)
     results.push({name:"studio-export-restoration",failures:[],viewport,scrollRestored:restored})
    }finally{await positions.dispose()}
   }
  }finally{await page.close();await stack.close()}
 }
}finally{await context.close();await browser.close();if(evidence){await mkdir(evidence,{recursive:true});await writeFile(path.join(evidence,"audit.json"),JSON.stringify({target,desktop,tablet,width,results},null,2)+"\n")}}
console.log(JSON.stringify({mobileAudit:target,desktop,tablet,width,results}))
if(!desktop&&process.env.MOBILE_BASELINE!=="1")assert.deepEqual(results.filter(result=>result.failures.length),[])

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
const desktop=process.env.MOBILE_DESKTOP==="1"
const results=[]
const browser=await chromium.launch()
const context=await browser.newContext({viewport:{width:desktop?1440:390,height:844},hasTouch:!desktop,isMobile:!desktop,deviceScaleFactor:desktop?1:3})
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
   await page.goto(stack.origin);await page.locator(".ad-sign-in").waitFor();await audit("studio-sign-in")
   const owner=await stack.fixture.signIn("mobile-audit@example.com")
   await context.addCookies(owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:stack.origin}}))
   await stack.deck(owner,"mobile-audit-deck")
   await page.goto(stack.origin);await page.locator(".deck-card").waitFor();await audit("studio-home")
   await page.goto(stack.origin+"/settings/account");await page.getByRole("button",{name:"Save name",exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.settings-row button')?.disabled);await audit("studio-settings")
   await page.goto(stack.origin+"/deck/mobile-audit-deck");await page.locator('[data-sync-state="saved"]').waitFor();await audit("studio-editor")
   if(!desktop)await page.setViewportSize({width:1440,height:844})
   await page.getByRole("button",{name:"Export",exact:true}).click();await page.locator("dialog[open]").waitFor()
   if(!desktop)await page.setViewportSize({width:390,height:844})
   await audit("studio-export")
  }finally{await page.close();await stack.close()}
 }
}finally{await context.close();await browser.close()}
if(evidence)await writeFile(path.join(evidence,"audit.json"),JSON.stringify(results,null,2)+"\n")
console.log(JSON.stringify({mobileAudit:target,desktop,results}))
if(!desktop&&process.env.MOBILE_BASELINE!=="1")assert.deepEqual(results.filter(result=>result.failures.length),[])

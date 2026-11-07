import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {pathToFileURL} from "node:url"
const root=process.cwd(),base=pathToFileURL(root+"/")
const {chromium}=await import(new URL("node_modules/playwright/index.mjs",base))
const {stack,seed,perform}=await import(new URL("bench/design-parity/capture.mjs",base))
const {readRegistry}=await import(new URL("bench/design-parity/registry.ts",base))
const owned=new Set("S61.01,S61.02,S61.03,S69.01,S71.01,S71.02,S71.03,S81.01,S81.02,S81.03,S91.01,S91.02,S91.03,S92.01,S92.02,S92.03,S92.04,S99.01,S99.02".split(","))
const browser=await chromium.launch({headless:true}),results=[],out=path.resolve(process.argv[2] ?? path.join(os.homedir(),"tmp/airdesign-settings-responsive"))
await mkdir(out,{recursive:true})
try{for(const entry of (await readRegistry()).filter(entry=>owned.has(entry.code))){
 let local,context,page
 try{
  local=await stack();const setup=await seed(local,entry)
  context=await browser.newContext({viewport:{width:1440,height:923},hasTouch:true,isMobile:true,locale:"en-US",timezoneId:"UTC",colorScheme:"light",reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const index=pair.indexOf("=");return {name:pair.slice(0,index),value:pair.slice(index+1),url:local.origin}}))
  page=await context.newPage();page.setDefaultTimeout(10000);await page.clock.setFixedTime(new Date("2026-11-06T03:00:00Z"))
  await page.goto(local.origin+setup.route,{waitUntil:"load"})
  if(entry.seed.startsWith("deck-"))await page.locator('.studio-editor[data-sync-state="saved"]').waitFor();else await page.waitForLoadState("networkidle")
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390 ? 844 : 923});await page.evaluate(()=>document.fonts.ready)
   const metrics=await page.evaluate(()=>({targets:[...document.querySelectorAll(".settings-page button,.settings-page select,.settings-tabs a,.settings-page summary,.agent-approval button,.agent-approval a,.credits-dialog button,.credits-dialog input,.export-dialog button,.export-dialog select,.export-dialog summary,.aira-usage-limit button,.payment-status a")].filter(control=>control.checkVisibility()).map(control=>{const box=control.getBoundingClientRect();return {label:control.getAttribute("aria-label")||control.textContent?.trim()||control.tagName,width:box.width,height:box.height,...(control.tagName==="SELECT"||control.tagName==="INPUT" ? {textHeight:box.height-parseFloat(getComputedStyle(control).paddingTop)-parseFloat(getComputedStyle(control).paddingBottom)-parseFloat(getComputedStyle(control).borderTopWidth)-parseFloat(getComputedStyle(control).borderBottomWidth),fontSize:parseFloat(getComputedStyle(control).fontSize)} : {})}}),width:innerWidth,content:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open],[role="dialog"]')].map(panel=>{const box=panel.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom}})}))
   if(metrics.content>metrics.width)throw new Error(`viewport-overflow:${width}:${metrics.content}`)
   if(metrics.dialogs.some(box=>box.left<0||box.right>metrics.width||box.top<0||box.bottom>(width===390 ? 844 : 923)))throw new Error(`dialog-outside-viewport:${width}`)
   if(metrics.targets.some(target=>target.width<43.5||target.height<43.5))throw new Error(`touch-target:${width}:${JSON.stringify(metrics.targets.filter(target=>target.width<43.5||target.height<43.5))}`)
   if(metrics.targets.some(target=>target.textHeight!==undefined&&target.textHeight<target.fontSize))throw new Error(`clipped-input-text:${width}`)
   const artifact=path.join(out,entry.code+"-"+width+".png");await page.screenshot({path:artifact,animations:"disabled",caret:"hide"});results.push({code:entry.code,width,metrics,artifact})
  }
  if(await page.locator('dialog[open],[role="dialog"]').count()){await page.keyboard.press("Escape");await page.locator('dialog[open],[role="dialog"]').waitFor({state:"hidden"})}
 }catch(error){results.push({code:entry.code,error:String(error)});if(page)await page.screenshot({path:path.join(out,entry.code+"-error.png")}).catch(()=>{})}
 finally{if(local?.parityFinish)await local.parityFinish();await context?.close();await local?.close()}
}}finally{await browser.close()}
await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2)+"\n")
process.stdout.write(JSON.stringify({screens:owned.size,captures:results.filter(item=>item.artifact).length,errors:results.filter(item=>item.error)}))
if(results.some(item=>item.error))process.exitCode=1

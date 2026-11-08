import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/editor-capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/phone-controls"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),results=[]
try{
  for(const code of ["S41.01","S42.01","S49.01","S49.02"]){
    const entry=(await readRegistry()).find(entry=>entry.code===code),local=await stack()
    let desktop,mobile
    try{
      const setup=await seed(local,entry)
      desktop=await browser.newContext({viewport:entry.viewport,reducedMotion:"reduce"})
      await desktop.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
      const page=await desktop.newPage();await page.goto(local.origin+setup.route)
      await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      for(const step of entry.steps)await perform(page,step,local,setup.owner)
      mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:"reduce"})
      await mobile.addCookies(await desktop.cookies())
      const phone=await mobile.newPage();await phone.goto(local.origin+setup.route)
      await phone.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      if(code!=="S41.01")await phone.getByRole("button",{name:"View Aira",exact:true}).click()
      if(code==="S49.02"){await perform(phone,{kind:"offline"},local,setup.owner);assert.equal(await phone.locator(".editor-status:not([data-font-state])").textContent(),"You're offline. Edits are saved on this device.")}
      const controls=await phone.locator('.studio-editor :is(button,a[href],select,summary,input:not([type=hidden]),textarea,[role=button])').evaluateAll(nodes=>nodes.filter(node=>node.checkVisibility()).map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {name:node.getAttribute("aria-label")??node.textContent?.trim().slice(0,70),width:r.width,height:r.height,font:s.fontSize,touch:s.touchAction,tap:s.webkitTapHighlightColor,input:node.matches('input,textarea,select')}}))
      await phone.screenshot({path:path.join(out,code+"-phone.png"),animations:"disabled"})
      results.push({code,controls})
      await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2))
      const small=controls.filter(control=>control.width<44||control.height<44)
      assert.deepEqual(small,[],`${code}: coarse-pointer controls below 44px`)
      assert(controls.every(control=>control.touch==="manipulation"),`${code}: touch manipulation missing`)
      assert(controls.filter(control=>control.input).every(control=>parseFloat(control.font)>=16),`${code}: input can trigger zoom`)
      assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${code}: phone overflow`)
    }finally{if(local.parityFinish)await local.parityFinish();await desktop?.close();await mobile?.close();await local.close()}
  }
  process.stdout.write(JSON.stringify({passed:true,out,scenarios:results.map(result=>result.code)})+"\n")
}finally{await browser.close()}

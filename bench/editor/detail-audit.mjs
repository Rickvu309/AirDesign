import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/detail-audit"))
await mkdir(out,{recursive:true})
const entries=(await readRegistry()).filter(entry=>/^(S41|S42|S43|S49)\./.test(entry.code)&&(!process.argv[3]||entry.code===process.argv[3])),results=[]
const browser=await chromium.launch({headless:true})
async function geometry(page){
  return page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,zoom:document.querySelector("[data-zoom-value]")?.textContent,composer:(()=>{const field=document.querySelector(".aira-composer textarea"),chips=document.querySelector(".aira-attachments");return field&&chips?{gap:field.getBoundingClientRect().top-(chips.lastElementChild??chips).getBoundingClientRect().bottom,padding:getComputedStyle(field).paddingBlock,placeholder:field.placeholder}:null})(),controls:[...document.querySelectorAll("button,a,input,textarea,select,summary")].filter(element=>element.checkVisibility()).map(element=>{const box=element.getBoundingClientRect(),style=getComputedStyle(element);return {name:element.getAttribute("aria-label")||element.textContent.trim().slice(0,60),tag:element.tagName,disabled:element.disabled??false,x:box.x,y:box.y,width:box.width,height:box.height,font:style.fontSize,touch:style.touchAction,tap:style.webkitTapHighlightColor,visible:box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth}})}))
}
try{
  for(const entry of entries){
    let local,desktop,phone
    try{
      local=await stack()
      const setup=await seed(local,entry),cookies=setup.owner.cookie.split("; ").map(pair=>{const index=pair.indexOf("=");return {name:pair.slice(0,index),value:pair.slice(index+1),url:local.origin}})
      desktop=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:"reduce"})
      await desktop.addCookies(cookies)
      const page=await desktop.newPage();await page.goto(local.origin+setup.route)
      await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      for(const step of entry.steps)await perform(page,step,local,setup.owner)
      await page.evaluate(()=>document.fonts.ready)
      const wide=await geometry(page)
      if(entry.code==="S42.04"){assert.equal(wide.composer.gap,10,"long composer chip/text gap");assert.equal(wide.composer.padding,"0px","long composer text padding");assert.equal(await page.locator(".aira-attachments svg").count(),1);assert.equal(await page.locator(".aira-attachments svg").evaluate(element=>element.getBoundingClientRect().width),12)}
      assert.equal(wide.viewport,1440);assert.ok(wide.document<=1440,`${entry.code} desktop overflow`)
      await page.screenshot({path:path.join(out,`${entry.code}-desktop.png`),animations:"disabled"})
      if(entry.code==="S42.02"){
        const usage=page.getByRole("button",{name:"Usage",exact:true})
        await usage.click();await page.getByLabel("Weekly usage",{exact:true}).waitFor()
        await page.screenshot({path:path.join(out,"usage-open.png"),animations:"disabled"})
        await page.keyboard.press("Escape");assert.equal(await usage.getAttribute("aria-expanded"),"false");assert.equal(await usage.evaluate(element=>element===document.activeElement),true)
        await usage.click();await page.getByLabel("Weekly usage",{exact:true}).waitFor();await page.locator(".aira-panel>header strong").click();assert.equal(await usage.getAttribute("aria-expanded"),"false")
      }
      phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:"reduce"})
      await phone.addCookies(cookies)
      const mobile=await phone.newPage();await mobile.goto(local.origin+setup.route)
      await mobile.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      assert.equal(await mobile.getByRole("navigation",{name:"Design tools",exact:true}).count(),0)
      assert.equal(await mobile.locator('[contenteditable="true"]').count(),0)
      if(!entry.code.startsWith("S41")){
        await mobile.getByRole("button",{name:"View Aira",exact:true}).tap()
        assert.equal(await mobile.getByRole("textbox",{name:"Message Aira",exact:true}).isDisabled(),true)
        assert.equal(await mobile.getByRole("button",{name:"Close Aira",exact:true}).evaluate(element=>getComputedStyle(element).clipPath),"none","phone Aira close must be visible")
      }
      if(entry.steps.some(step=>step.kind==="offline")){
        await phone.setOffline(true);await mobile.locator('.studio-editor[data-sync-state="offline"]').waitFor()
      }
      await mobile.evaluate(()=>document.fonts.ready)
      const narrow=await geometry(mobile)
      await mobile.screenshot({path:path.join(out,`${entry.code}-phone.png`),animations:"disabled"})
      await writeFile(path.join(out,`${entry.code}.json`),JSON.stringify({desktop:wide,phone:narrow},null,2))
      assert.equal(narrow.viewport,390);assert.ok(narrow.document<=390,`${entry.code} phone overflow`)
      const small=narrow.controls.filter(control=>control.visible&&!control.disabled&&(control.width<44||control.height<44))
      assert.deepEqual(small,[],`${entry.code} touch target smaller than44`)
      assert(narrow.controls.every(control=>control.touch==="manipulation"),`${entry.code} touch manipulation missing`)
      assert(narrow.controls.every(control=>control.tap==="rgba(0, 0, 0, 0)"),`${entry.code} tap highlight visible`)
      const tiny=narrow.controls.filter(control=>["INPUT","TEXTAREA","SELECT"].includes(control.tag)&&parseFloat(control.font)<16)
      assert.deepEqual(tiny,[],`${entry.code} coarse input smaller than16`)
      if(!entry.code.startsWith("S41")){
        await mobile.getByRole("button",{name:"Close Aira",exact:true}).tap()
        assert.equal(await mobile.getByRole("complementary",{name:"Aira",exact:true}).count(),0)
        await mobile.getByRole("button",{name:"View Aira",exact:true}).tap()
        await mobile.getByRole("textbox",{name:"Message Aira",exact:true}).waitFor()
      }
      results.push({code:entry.code,desktop:wide.zoom,phone:"readonly",overflow:false,touchTargets:true})
      process.stdout.write(`${entry.code} desktop/phone PASS\n`)
    }finally{if(local?.parityFinish)await local.parityFinish();await phone?.close();await desktop?.close();await local?.close()}
  }
}finally{await browser.close();await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2))}

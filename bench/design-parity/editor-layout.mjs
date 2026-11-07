import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "./capture.mjs"
import {readRegistry} from "./registry.ts"

const out=path.resolve(process.argv[2] ?? path.join(os.homedir(),"tmp/airdesign-polish/editor/layout"))
await mkdir(out,{recursive:true})
const entries=(await readRegistry()).filter(entry=>/^(S41|S42|S43|S49)\./.test(entry.code)),results=[]
const browser=await chromium.launch({headless:true})
let local
try {
  for(const entry of entries){
    let context,mobile
    try{
      local=await stack()
      const setup=await seed(local,entry)
      context=await browser.newContext({viewport:entry.viewport,locale:"en-US",reducedMotion:"reduce"})
      await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const index=pair.indexOf("=");return {name:pair.slice(0,index),value:pair.slice(index+1),url:local.origin}}))
      const page=await context.newPage();page.setDefaultTimeout(10000)
      await page.goto(local.origin+setup.route)
      await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      for(const step of entry.steps){
        const before=step.kind==="offline" ? await page.locator('.editor-slide:not([hidden]) .slide-preview').boundingBox() : null
        await perform(page,step,local,setup.owner)
        if(before){const after=await page.locator('.editor-slide:not([hidden]) .slide-preview').boundingBox();assert.deepEqual(after,before,"Offline recovery controls moved the canvas");results.push({check:"Offline canvas position",passed:true})}
      }
      if(entry.code==="S42.01")assert(await page.locator('.editor-slide[data-selected=true]>.slide-preview').evaluate(node=>getComputedStyle(node).boxShadow.includes('28px')),"Working slide has no visible status glow")
      if(entry.code==="S42.04"){
        const width=await page.locator('.aira-composer textarea').evaluate(node=>({input:node.getBoundingClientRect().width,panel:node.closest('.aira-composer').getBoundingClientRect().width}))
        assert(width.input>width.panel*.85,"Long prompt is squeezed beside the scope selector")
      }
      if(entry.code==="S43.06"){
        const gap=await page.evaluate(()=>document.querySelector('.editor-tool-text').getBoundingClientRect().top-document.querySelector('.editor-bar>.ad-button').getBoundingClientRect().bottom)
        assert(gap>=0,"New slide covers the text tool header")
      }
      if(entry.code==="S42.02"){
        const bounds=await page.evaluate(()=>{
          const box=selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}}
          return {panel:box('.aira-panel'),export:box('.editor-export'),frames:[...document.querySelectorAll('.editor-filmstrip .slide-preview')].map(frame=>{const outer=frame.getBoundingClientRect(),slide=frame.querySelector('[data-slide]').getBoundingClientRect();return {outer:{width:outer.width,height:outer.height},slide:{width:slide.width,height:slide.height}}})}
        })
        assert(bounds.panel.y>=bounds.export.bottom,"AD-17: Aira overlaps Export or zoom")
        assert.equal(bounds.frames.length,8,"AD-11: Missing thumbnail navigation")
        for(const frame of bounds.frames){assert(frame.outer.width>40,"Thumbnail collapsed");assert(Math.abs(frame.outer.width-frame.slide.width)<1,"Thumbnail content exceeds its frame");assert(Math.abs(frame.outer.height-frame.slide.height)<1,"Thumbnail content exceeds its frame")}
        await page.getByRole('button',{name:'Go to slide 5',exact:true}).click()
        await page.locator('.editor-slide:not([hidden]) [data-slide="s4"]').waitFor()
        results.push({check:"AD-11, AD-17 and thumbnail bounds",passed:true,bounds})
      }
      await page.screenshot({path:path.join(out,`${entry.code}-desktop.png`),animations:"disabled"})
      await page.setViewportSize({width:1440,height:960})
      const desktopWidth=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))
      assert(desktopWidth.document<=1440 && desktopWidth.viewport===1440,`${entry.code}: Desktop overflow ${JSON.stringify(desktopWidth)}`)
      await page.screenshot({path:path.join(out,`${entry.code}-1440.png`),animations:"disabled"})
      results.push({check:entry.code+" 1440 desktop",passed:true,width:desktopWidth})
      mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:"reduce"})
      await mobile.addCookies(await context.cookies())
      const phone=await mobile.newPage();phone.setDefaultTimeout(10000)
      await phone.goto(local.origin+setup.route)
      await phone.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      assert.equal(await phone.getByRole('navigation',{name:'Design tools',exact:true}).count(),0,"Phone must remain read-only")
      assert.equal(await phone.locator('[contenteditable="true"]').count(),0,"Phone exposes editing")
      const number=await phone.locator('.slide-select').first().evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);return {text:range.getBoundingClientRect().top,slide:node.closest('.editor-slide').querySelector('.slide-preview').getBoundingClientRect().top}})
      assert(number.text<number.slide+16,"Phone slide number overlaps the title")
      if(!entry.code.startsWith('S41'))await phone.getByRole('button',{name:'View Aira',exact:true}).click()
      if(entry.steps.some(step=>step.kind==="offline")){
        await phone.context().setOffline(true);await phone.locator('.studio-editor[data-sync-state="offline"]').waitFor()
        const notice=phone.locator('.studio-editor>.editor-status:not([hidden])'),bounds=await notice.boundingBox()
        assert(bounds.width>=300 && bounds.x>=16 && bounds.x+bounds.width<=374,"Phone offline banner is clipped by the desktop panel width")
        assert((await notice.textContent()).includes("You're offline."),"Phone offline banner hides connection state")
        assert.equal(await phone.locator('.editor-status[data-font-state=ready]').isVisible(),false,"Offline banner reveals the hidden font status")
      }
      const width=await phone.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))
      assert(width.document<=390 && width.viewport===390,`${entry.code}: Phone overflow ${JSON.stringify(width)}`)
      if(!entry.code.startsWith('S41'))assert(await phone.getByLabel('Message Aira',{exact:true}).isDisabled(),"Phone composer allows edits")
      await phone.screenshot({path:path.join(out,`${entry.code}-phone.png`),animations:"disabled"})
      results.push({check:entry.code+" read-only phone",passed:true,width})
      process.stdout.write(`${entry.code} phone PASS\n`)
    }finally{if(local?.parityFinish)await local.parityFinish();await mobile?.close();await context?.close();await local?.close();local=undefined}
  }
}finally{if(local?.parityFinish)await local.parityFinish();await browser.close();await local?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(results,null,2)+'\n')}
process.stdout.write(`PASS ${results.length} browser checks: ${out}\n`)

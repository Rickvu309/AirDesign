import {readFile} from "node:fs/promises"
import {chromium} from "playwright"
import {expect,it} from "vitest"
import {assertScenarioDOM,assertScenarioCopy,assertDialogActions,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry,parseRegistry,resolveCopy,passesParity,validateRegistry} from "./registry.ts"
import {calibrationFor} from "./targets.ts"
import {compareDesign} from "./metric.mjs"
import {compareComponent,cropComponent,faithfulReference} from "./component-metric.mjs"

it("rejects literal required copy and unknown keys at the registry boundary",async()=>{
  const entries=await readRegistry()
  for(const entry of entries){
    expect(()=>parseRegistry([{...entry,assertions:{...entry.assertions,texts:["Empty Trash?"]}}])).toThrow()
    expect(()=>parseRegistry([{...entry,assertions:{...entry.assertions,copyKeys:["Empty Trash?"]}}])).toThrow(/required-copy-must-use-copy-kit-key/)
    expect(()=>parseRegistry([{...entry,assertions:{...entry.assertions,controls:[{role:"button",name:"Delete permanently"}]}}])).toThrow()
    expect(()=>parseRegistry([{...entry,assertions:{...entry.assertions,controls:[{role:"button",nameKey:"Delete permanently"}]}}])).toThrow(/required-copy-must-use-copy-kit-key/)
    if(entry.assertions.probe.kind==="dialog")expect(()=>parseRegistry([{...entry,assertions:{...entry.assertions,probe:{...entry.assertions.probe,title:"Sign out?"}}}])).toThrow()
    for(const key of [...entry.assertions.copyKeys,...entry.assertions.entryCopyKeys??[],...entry.assertions.controls.flatMap(control=>"nameKey" in control ? [control.nameKey] : [])])expect(resolveCopy(key,entry.assertions.copyValues)).not.toMatch(/\{[^}]+\}/)
  }
  expect(resolveCopy("trash.empty_title",{n:"3"})).toBe("Delete 3 decks for good?")
  expect(()=>resolveCopy("trash.empty_title")).toThrow("missing-copy-value")
})

it("requires independently calibrated components in both normal and strict gates",async()=>{
  const entries=await readRegistry(),components=entries.filter(entry=>entry.component)
  expect(components).toHaveLength(15)
  for(const entry of components){
    const component=entry.component!
    const reachable={...entry,status:"reachable",steps:[]} satisfies typeof entry
    expect(passesParity(reachable,0,false)).toBe(false)
    expect(passesParity(reachable,0,true,component.target)).toBe(calibrationFor(entry.code).status==="uncalibrated" ? null : true)
    expect(passesParity(reachable,0,false,component.target+0.00001)).toBe(false)
    expect(passesParity(reachable,0,true,NaN)).toBe(false)
    expect(passesParity({...reachable,component:{...component,target:1}},0,false,0)).toBe(false)
    expect(passesParity({...reachable,component:undefined},0,true,0)).toBe(false)
    const image=entry.design.split("/").at(-1)!,baseline={[entry.code]:entry.budget}
    expect(()=>validateRegistry([{...entry,component:undefined}],[image],baseline)).toThrow("uncalibrated-component")
  }
})

it("rejects the round-6 bitmap dialog bypass through copy, actions and independent component pixels",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.03")!,component=entry.component!
  const design=await readFile(entry.design),fonts=await Promise.all([400,600].map(async weight=>`@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff2;base64,${(await readFile(`packages/ui/fonts/geist-latin-${weight}.woff2`)).toString("base64")})}`))
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    page.setDefaultTimeout(10000)
    await page.setContent(`<style>${fonts.join("")}body{margin:0}canvas{position:fixed;inset:0;z-index:-1}#brand{position:absolute;left:305px;top:850px;font:2px Geist;color:#222}#open{position:absolute;left:450px;top:850px;font:2px Geist;border:0;padding:0}#fake{position:fixed;inset:0;margin:0;padding:0;border:0;width:1470px;height:923px;background:transparent}h2{position:absolute;left:559px;top:440px;margin:0;font:600 17px Geist;color:#222}#delete,#cancel{position:absolute;top:505px;height:36px;font:600 14px Geist;border:0;border-radius:8px}#delete{left:775px;width:136px;background:#dc3b3b;color:white}#cancel{left:688px;width:79px;background:white;color:#222}</style><canvas width="1470" height="923"></canvas><span id="brand">AirDesign</span><dialog id="fake" open><h2>Empty Trash?</h2><button id="delete">Delete permanently</button><button id="cancel">Cancel</button></dialog><details><summary aria-label="Account menu" style="position:absolute;left:450px;top:850px;font:2px Geist;list-style:none">Sign out</summary><button id="open">Sign out</button></details><dialog id="probe" aria-label="Sign out?"><button id="close">Cancel</button></dialog><script>document.querySelector('#open').onclick=()=>{document.querySelector('#probe').showModal();document.querySelector('details').open=false};document.querySelector('#close').onclick=()=>document.querySelector('#probe').close()</script>`)
    await page.evaluate(async src=>{
      await document.fonts.ready
      const image=new Image();image.src=src;await image.decode()
      const context=document.querySelector("canvas")!.getContext("2d")!
      context.drawImage(image,0,0);context.fillStyle="white";context.fillRect(558,439,280,22);context.fillRect(688,504,224,38)
    },`data:image/png;base64,${design.toString("base64")}`)
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    page.setDefaultTimeout(500)
    await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()})
    const capture=await page.screenshot(),frame=await compareDesign(design,capture)
    expect(frame.score).toBeLessThan(entry.target)
    expect(frame.score).toBeCloseTo(0.054781,5)
    await expect(assertScenarioCopy(page,["trash.empty_title"],entry.code,entry.assertions.copyValues)).rejects.toThrow(/required-visible-copy/)
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow()
    const box=await page.locator("#fake").boundingBox()
    expect(box).not.toBeNull()
    const wrongBounds=await compareComponent(design,capture,component.designBox,box!)
    expect(passesParity(entry,frame.score,true,wrongBounds.metric.score)).toBe(false)
    const wrongRegion=await compareComponent(design,capture,component.designBox,component.designBox)
    expect(wrongRegion.metric.score).toBeGreaterThan(component.target)
    expect(passesParity(entry,frame.score,true,wrongRegion.metric.score)).toBe(false)
    process.stdout.write(JSON.stringify({dialogProbe:{frameScore:frame.score,componentScore:wrongRegion.metric.score,componentTarget:component.target,boundsScore:wrongBounds.metric.score,passed:false}})+"\n")
  }finally{await browser.close()}
},30000)

it("locates both native and accessible dialogs for independent live crops",async()=>{
  const entries=(await readRegistry()).filter(entry=>entry.component?.kind==="dialog")
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage()
    for(const html of ['<dialog open>Delete for good</dialog>','<div role="dialog">Delete for good</div>','<div role="alertdialog">Delete for good</div>']){
      await page.setContent(html)
      if(html.startsWith("<div"))expect(await page.locator("dialog[open]").count()).toBe(0)
      for(const entry of entries){
        const locator=page.locator(entry.component!.selector)
        expect(await locator.count(),entry.code).toBe(1)
        const box=await locator.boundingBox()
        expect(box?.width,entry.code).toBeGreaterThan(0)
        expect(box?.height,entry.code).toBeGreaterThan(0)
      }
    }
  }finally{await browser.close()}
})

it("accepts painted dialog actions and rejects wrapping, clipping and missing Cancel outlines separately",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.03")!
  const fonts=await Promise.all([400,600].map(async weight=>`@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff2;base64,${(await readFile(`packages/ui/fonts/geist-latin-${weight}.woff2`)).toString("base64")})}`))
  const html=`<style>${fonts.join("")}dialog{padding:24px;width:400px}button{box-sizing:border-box;height:36px;border-radius:8px;font:600 14px Geist}#delete{width:136px;border:1px solid #b92f2f;background:#d93f3f;color:white}#cancel{width:79px;border:1px solid #d7d7d6;background:white;color:#222}</style><dialog open><button id="delete">Delete for good</button><button id="cancel">Cancel</button></dialog>`
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(html);await page.evaluate(async()=>{await document.fonts.ready})
    await expect(assertDialogActions(page,entry)).resolves.toBeUndefined()
    for(const mutation of ["document.querySelector('#delete').style.width='70px'","document.querySelector('#delete').style.cssText='width:70px;white-space:nowrap;overflow:hidden'","document.querySelector('#cancel').style.border='none'","document.querySelector('#cancel').style.borderColor='transparent'","document.querySelector('#delete').style.background='blue'"]){
      await page.setContent(html);await page.evaluate(mutation)
      await expect(assertDialogActions(page,entry),mutation).rejects.toThrow()
    }
  }finally{await browser.close()}
})

it("rejects incorrect component crops while retaining faithful references",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.03")!,component=entry.component!,design=await readFile(entry.design)
  const box=component.designBox
  const reference=(await compareComponent(design,await faithfulReference(design),box,{...box,left:box.left+1,top:box.top+1})).metric
  expect(passesParity(entry,0,false,reference.score)).toBe(true)
  expect(passesParity(entry,0,true,reference.score)).toBe(null)
  const displaced=await compareComponent(design,design,component.designBox,{...component.designBox,left:0,top:0})
  expect(passesParity(entry,0,true,displaced.metric.score)).toBe(false)
  await expect(cropComponent(design,{left:-1,top:0,width:100,height:100})).rejects.toThrow("invalid-component-box")
})

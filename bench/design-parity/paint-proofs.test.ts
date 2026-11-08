import {chromium} from "playwright"
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {expect,it,vi} from "vitest"
import {assertRendered,assertScenarioControls,assertScenarioCopy,assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {type Scenario,readRegistry,validateIdentity,seedFiles,passesParity} from "./registry.ts"
import {iconPaths,iconStrokeWidth} from "../../packages/ui/src/icon/icon-paths.ts"
import {compareDesign} from "./metric.mjs"

it("proves real paint despite perfect canvas pixels and working invisible controls",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry=original
  const design=await readFile(entry.design),browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<style>body{margin:0}main{filter:opacity(0)}h1{font:600 26px Geist;color:#222}.deck-card-details>p{font:400 12px Geist;color:#666}canvas{position:fixed;inset:0;pointer-events:none;z-index:-1}</style><canvas width="1470" height="923"></canvas><main class="workspace-home"><span>AirDesign</span><div class="home-heading"><h1>Recents</h1></div><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="${iconStrokeWidth("search")}"><path d="${iconPaths.search}"/></svg><div class="deck-card-details"><p>Edited today</p></div><button>Commands</button><details style="top:720px;overflow:visible"><summary aria-label="Account menu" style="width:4px;height:1px;overflow:hidden;list-style:none">Account</summary><button id="open">Sign out</button></details><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog></main><script>document.querySelector('#open').onclick=()=>{document.querySelector('details').open=false;document.querySelector('dialog').showModal()};document.querySelector('#close').onclick=()=>document.querySelector('dialog').close()</script>`)
    await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();document.querySelector("canvas")!.getContext("2d")!.drawImage(image,0,0)},`data:image/png;base64,${design.toString("base64")}`)
    expect((await compareDesign(design,await page.screenshot())).score).toBe(0)
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow(/scenario=S31.02.*selector=.*check=required-visible-copy.*expected=.*actual=/)
    for(const style of ["filter:opacity(0)","mix-blend-mode:screen","opacity:0","transform:scale(0.001);transform-origin:top left"]){
      await page.setContent(`<style>body{background:white}</style><p style="${style}">Required text</p>`)
      await expect(assertRendered(page.locator("p")),style).rejects.toThrow()
    }
    await page.setContent('<p style="clip-path:inset(-1000px)">Required text</p>')
    const before=await page.screenshot()
    await expect(assertRendered(page.locator("p"))).resolves.toBeUndefined()
    expect(await page.screenshot()).toEqual(before)
    expect(await page.locator("p").getAttribute("style")).toBe("clip-path:inset(-1000px)")
    await page.locator("p").evaluate(element=>element.style.clipPath="none")
    expect(await page.screenshot()).toEqual(before)
  }finally{await browser.close()}
})

it("hashes actual geometry and viewBox instead of trusting a search label",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:[],structure:{icons:[{region:"main",name:"search",size:16,color:"ink" as const}],textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    const content=`<main><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="${iconStrokeWidth("search")}"><path d="${iconPaths.search}"/></svg></main>`
    await page.setContent(content)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    await page.locator("path").evaluate(element=>element.setAttribute("d",element.getAttribute("d")!.replaceAll("21","21.0")))
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    const before=await page.screenshot()
    await page.locator("path").evaluate(element=>element.setAttribute("d","M21 21L16 16M18 10A8 8 0 1 1 2 10A8 8 0 0 1 18 10"))
    expect(await page.screenshot()).toEqual(before)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    for(const mutation of ["document.querySelector('path').setAttribute('d','M21 21L16 16M17 10A7 7 0 1 1 3 10A7 7 0 0 1 17 10')","document.querySelector('path').setAttribute('d','M2 2L16 16M16 2L2 16')","document.querySelector('svg').setAttribute('viewBox','0 0 20 20')","document.querySelector('path').setAttribute('transform','rotate(90 12 12)')","document.querySelector('path').style.d='path(\"M2 2L16 16M16 2L2 16\")'","document.querySelector('svg').style.transform='rotate(90deg)'"]){
      await page.setContent(content)
      await page.evaluate(mutation)
      await expect(assertScenarioDOM(page,entry)).rejects.toThrow(/scenario=S31.02.*selector=.*check=icon-geometry.*expected=.*actual=/)
    }
  }finally{await browser.close()}
})

it("locks fixture title bytes as scenario identity",async()=>{
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-fixture-lock-"))
  try{
    for(const file of [...seedFiles,"bench/design-parity/scenario-lock.json"]){await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await copyFile(file,path.join(cwd,file))}
    const file=path.join(cwd,"bench/design-parity/capture.mjs"),source=await readFile(file,"utf8")
    expect(source).toContain('"Project Atlas","Q3 Investor Update"')
    await writeFile(file,source.replace('"Project Atlas","Q3 Investor Update"','"Fake title","Q3 Investor Update"'))
    await expect(validateIdentity(await readRegistry(),cwd)).rejects.toThrow(/scenario=.*selector=seed:.*check=scenario-lock-mismatch.*expected=.*actual=/)
  }finally{await rm(cwd,{recursive:true,force:true})}
})

it("rejects four-pixel substitute ink over a strict-passing bitmap",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const design=await readFile(entry.design),browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<style>body{margin:0}canvas{position:fixed;inset:0;z-index:-1}main>*{position:absolute;left:1200px;width:4px;height:1px;margin:0;padding:0;border:0;border-top:1px solid #222;overflow:hidden;-webkit-text-fill-color:transparent}span{top:120px}#commands{top:240px}.home-heading{top:360px;height:2px;border:0}.home-heading h1{font:600 26px Geist;color:#222;margin:0;width:4px;height:1px;border-top:1px solid #222;-webkit-text-fill-color:transparent}svg{top:480px;stroke:none}.deck-card-details{top:600px;height:2px;border:0}.deck-card-details p{font:400 12px Geist;color:#666;margin:0;width:4px;height:1px;border-top:1px solid #666;-webkit-text-fill-color:transparent}#open{top:720px}dialog:not([open]){display:none}dialog[open]{position:fixed;width:200px;height:100px;overflow:visible}dialog button{-webkit-text-fill-color:black}</style><canvas width="1470" height="923"></canvas><main class="workspace-home"><span>AirDesign</span><button id="commands">Commands</button><div class="home-heading"><h1>Recents</h1></div><svg data-icon="search" viewBox="0 0 24 24"><path d="${iconPaths.search}"/></svg><div class="deck-card-details"><p>Edited today</p></div><details style="top:720px;overflow:visible"><summary aria-label="Account menu" style="width:4px;height:1px;overflow:hidden;list-style:none">Account</summary><button id="open">Sign out</button></details><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog></main><script>document.querySelector('#open').onclick=()=>{document.querySelector('details').open=false;document.querySelector('dialog').showModal()};document.querySelector('#close').onclick=()=>document.querySelector('dialog').close()</script>`)
    await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();document.querySelector("canvas")!.getContext("2d")!.drawImage(image,0,0)},`data:image/png;base64,${design.toString("base64")}`)
    const score=(await compareDesign(design,await page.screenshot())).score
    expect(passesParity(entry,score,true)).toBe(true)
    await expect(probeScenarioInteraction(page,entry)).resolves.toBeUndefined()
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow()
  }finally{await browser.close()}
})

it("rejects canonical icons at the wrong rendered size or color",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:[],structure:{icons:[{region:"main",name:"search",size:16,color:"ink" as const}],textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    for(const [size,color] of [[10,"red"],[8,"black"],[16,"red"]]){
      await page.setContent(`<main><svg data-icon="search" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${iconStrokeWidth("search")}"><path d="${iconPaths.search}"/></svg></main>`)
      await expect(assertScenarioDOM(page,entry)).rejects.toThrow()
    }
  }finally{await browser.close()}
})

it("requires elements to own the ink supplied by an image in the same box",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:600,height:200}})
    for(const tag of ["span","button"]){
      await page.setContent(`<style>body{background:white}.live{position:absolute;left:24px;top:24px;margin:0;padding:0;border:0;background:transparent;font:20px Arial;color:#222}</style><${tag} class="live">Required text</${tag}>`)
      const locator=page.locator(".live"),box=(await locator.boundingBox())!
      await expect(assertRendered(locator,tag==="button")).resolves.toBeUndefined()
      const image=await locator.screenshot()
      await page.evaluate(({src,box})=>{
        const image=document.createElement("img")
        image.src=src
        image.style.cssText=`position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;pointer-events:none`
        document.body.prepend(image)
        const live=document.querySelector<HTMLElement>(".live")!
        live.style.webkitTextFillColor="transparent"
        live.style.borderBottom="1px solid #222"
      },{src:`data:image/png;base64,${image.toString("base64")}`,box})
      await page.evaluate(async()=>{await Promise.all([...document.images].map(image=>image.decode()))})
      await expect(assertRendered(locator,tag==="button")).rejects.toThrow(/ink-ownership/)
    }
  }finally{await browser.close()}
})

it("uses declared icon size and color tokens for its raster estimate",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:[],structure:{icons:[{region:"main",name:"search",size:20,color:"gray.600" as const}],textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<main><svg data-icon="search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="${iconStrokeWidth("search")}"><path d="${iconPaths.search}"/></svg></main>`)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
  }finally{await browser.close()}
})


it.each(["ordinary","nested","input","placeholder","textarea"])("measures actual %s label glyph paint and restores exact DOM",async kind=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:600,height:200}})
    const content=kind==="ordinary" ? '<p class="label">Required text</p>' : kind==="nested" ? '<button class="label"><span style="letter-spacing:0.1px"><strong>Required text</strong></span></button>' : kind==="textarea" ? '<textarea class="label">Required text</textarea>' : kind==="placeholder" ? '<input class="label" placeholder="Required text">' : '<input class="label" value="Required text">'
    await page.setContent(`<style>body{background:white}.label{font:20px Arial;color:#222;background:#fff;border:1px solid #222;padding:8px}</style>${content}`)
    const baseline=await page.locator("body").innerHTML()
    await expect(assertRendered(page.locator(".label"),kind!=="ordinary")).resolves.toBeUndefined()
    expect(await page.locator("body").innerHTML()).toBe(baseline)
  }finally{await browser.close()}
})

it.each(["transparent","text-fill","missing","border-only","icon-only","raster","hidden","occluded"])("rejects independent %s copy from a passing glyph baseline",async mutation=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:600,height:200}})
    await page.setContent('<style>body{background:white}button{font:20px Arial;color:#222;background:white;border:2px solid #222;padding:8px;position:relative}</style><button aria-label="Delete for good"><span>Delete for good</span></button>')
    const button=page.locator("button")
    await expect(assertRendered(button,true)).resolves.toBeUndefined()
    await expect(assertScenarioCopy(page,["trash.empty_action"])).resolves.toBeUndefined()
    const image=await button.screenshot()
    await button.evaluate((element,{mutation,src})=>{
      const label=element.querySelector("span")
      if(!label)throw new Error("missing-paint-baseline-label")
      if(mutation==="transparent")label.style.color="transparent"
      else if(mutation==="text-fill")label.style.webkitTextFillColor="transparent"
      else if(mutation==="missing"||mutation==="border-only"||mutation==="icon-only"){
        label.remove()
        if(mutation!=="missing"){element.style.width="180px";element.style.height="45px"}
        if(mutation==="icon-only"){
          const icon=document.createElementNS("http://www.w3.org/2000/svg","svg")
          icon.setAttribute("width","20");icon.setAttribute("height","20")
          const path=document.createElementNS("http://www.w3.org/2000/svg","path")
          path.setAttribute("d","M2 2L18 18M18 2L2 18");path.setAttribute("stroke","#222")
          icon.append(path);element.append(icon)
        }
      }else if(mutation==="raster"){
        label.style.webkitTextFillColor="transparent"
        element.style.backgroundImage=`url("${src}")`
        element.style.backgroundSize="100% 100%"
      }else if(mutation==="hidden")label.style.visibility="hidden"
      else{
        const cover=document.createElement("div")
        cover.style.cssText="position:absolute;inset:0;background:white;pointer-events:none"
        element.append(cover)
      }
    },{mutation,src:`data:image/png;base64,${image.toString("base64")}`})
    const mutated=await page.locator("body").innerHTML()
    await expect(assertRendered(button,true)).rejects.toThrow(/text-ink-ownership/)
    await expect(assertScenarioCopy(page,["trash.empty_action"])).rejects.toThrow(/required-visible-copy/)
    expect(await page.locator("body").innerHTML()).toBe(mutated)
  }finally{await browser.close()}
})

it.each(["capture","mutation"])("restores every label inline value after a forced %s measurement error",async fault=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:600,height:200}})
    await page.setContent('<button style="font:20px Arial;color:#222"><span style="text-shadow:none!important"><strong style="letter-spacing:0.2px">Required text</strong></span></button>')
    const button=page.locator("button"),baseline=await page.locator("body").innerHTML()
    await expect(assertRendered(button,true)).resolves.toBeUndefined()
    if(fault==="capture"){
      const screenshot=page.screenshot.bind(page)
      let calls=0
      const spy=vi.spyOn(page,"screenshot").mockImplementation(async options=>{
        calls++
        if(calls===2){
          expect(await page.locator("strong").getAttribute("style")).toContain("-webkit-text-fill-color")
          throw new Error("forced-label-capture-error")
        }
        return screenshot(options)
      })
      try{await expect(assertRendered(button,true)).rejects.toThrow("forced-label-capture-error")}finally{spy.mockRestore()}
      expect(calls).toBe(2)
    }else{
      const native=await page.evaluateHandle(()=>CSSStyleDeclaration.prototype.setProperty)
      try{
        await page.evaluate(()=>{
          const native=CSSStyleDeclaration.prototype.setProperty
          CSSStyleDeclaration.prototype.setProperty=function(property,value,priority){
            if(property==="-webkit-text-stroke-color")throw new Error("forced-label-mutation-error")
            native.call(this,property,value,priority)
          }
        })
        await expect(assertRendered(button,true)).rejects.toThrow("forced-label-mutation-error")
      }finally{try{await native.evaluate(original=>{CSSStyleDeclaration.prototype.setProperty=original})}finally{await native.dispose()}}
    }
    expect(await page.locator("body").innerHTML()).toBe(baseline)
    await expect(assertRendered(button,true)).resolves.toBeUndefined()
    expect(await page.locator("body").innerHTML()).toBe(baseline)
  }finally{await browser.close()}
})


it("measures selected native option paint and rejects independent control substitutions",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S61.01")
  if(!entry)throw new Error("missing-native-select-contract")
  const browser=await chromium.launch()
  try{
    const page=await browser.newPage()
    const mount=()=>page.setContent('<label>File format<select><option value="pptx">PowerPoint</option><option value="pdf">PDF</option></select></label><style>select{font:16px Arial;color:#222;background:white;width:180px;height:44px}</style>')
    const controls:Scenario={...entry,component:undefined,assertions:{...entry.assertions,controls:[{role:"combobox",nameKey:"export.file_format",value:"pptx"}]}}
    await mount()
    await expect(assertScenarioControls(page,controls)).resolves.toBeUndefined()
    for(const mutation of ["missing","hidden","value","wrong-control","transparent","image"]){
      await mount()
      await page.locator("select").evaluate((element,mutation)=>{
        if(mutation==="missing")element.remove()
        if(mutation==="hidden")element.style.display="none"
        if(mutation==="value"){if(!(element instanceof HTMLSelectElement))throw new Error("native-select-required");element.value="pdf"}
        if(mutation==="wrong-control")element.outerHTML='<div role="combobox" aria-label="File format">PowerPoint</div>'
        if(mutation==="transparent")element.style.webkitTextFillColor="transparent"
        if(mutation==="image")element.outerHTML='<img role="combobox" aria-label="File format" alt="PowerPoint" width="180" height="44">'
      },mutation)
      await expect(assertScenarioControls(page,controls),mutation).rejects.toThrow()
    }
  }finally{await browser.close()}
})


it("requires actions in their registered open dialog rather than a blocked background or nested owner",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S33.03")
  if(!original)throw new Error("missing-dialog-contract")
  const entry:Scenario={...original,component:{kind:"dialog",selector:"#owner",designBox:{left:0,top:0,width:400,height:200},target:0.01},assertions:{...original.assertions,controls:[{role:"button",nameKey:"common.cancel"}]}}
  const browser=await chromium.launch()
  try{
    const page=await browser.newPage()
    const mount=()=>page.setContent('<button>Cancel</button><div role="dialog" aria-modal="true" id="owner"><p>Confirmation</p><p hidden>Unavailable state</p><button>Cancel</button></div><style>#owner{position:fixed;inset:0;background:white}button{width:100px;height:44px}</style>')
    await mount()
    await expect(assertScenarioControls(page,entry)).resolves.toBeUndefined()
    for(const mutation of ["missing","hidden","wrong-owner","nested-owner"]){
      await mount()
      await page.locator("#owner button").evaluate((element,mutation)=>{
        if(mutation==="missing")element.remove()
        if(mutation==="hidden")element.style.visibility="hidden"
        if(mutation==="wrong-owner")document.body.append(element)
        if(mutation==="nested-owner"){const dialog=document.createElement("div");dialog.setAttribute("role","dialog");element.replaceWith(dialog);dialog.append(element)}
      },mutation)
      await expect(assertScenarioControls(page,entry),mutation).rejects.toThrow()
    }
  }finally{await browser.close()}
})

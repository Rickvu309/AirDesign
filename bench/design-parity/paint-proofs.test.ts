import {chromium} from "playwright"
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {expect,it} from "vitest"
import {assertRendered,assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry,validateIdentity,seedFiles,passesParity} from "./registry.ts"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"
import {compareDesign} from "./metric.mjs"

it("proves real paint despite perfect canvas pixels and working invisible controls",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry=original
  const design=await readFile(entry.design),browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<style>body{margin:0}main{filter:opacity(0)}h1{font:600 26px Geist;color:#222}.deck-card-details>p{font:400 12px Geist;color:#666}canvas{position:fixed;inset:0;pointer-events:none;z-index:-1}</style><canvas width="1470" height="923"></canvas><main class="workspace-home"><span>AirDesign</span><div class="home-heading"><h1>Recents</h1></div><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><path d="${iconPaths.search}"/></svg><div class="deck-card-details"><p>Edited today</p></div><button>Commands</button><details style="top:720px;overflow:visible"><summary aria-label="Account menu" style="width:4px;height:1px;overflow:hidden;list-style:none">Account</summary><button id="open">Sign out</button></details><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog></main><script>document.querySelector('#open').onclick=()=>{document.querySelector('details').open=false;document.querySelector('dialog').showModal()};document.querySelector('#close').onclick=()=>document.querySelector('dialog').close()</script>`)
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
    const content=`<main><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="1.5"><path d="${iconPaths.search}"/></svg></main>`
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
      await page.setContent(`<main><svg data-icon="search" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5"><path d="${iconPaths.search}"/></svg></main>`)
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
    await page.setContent(`<main><svg data-icon="search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="1.5"><path d="${iconPaths.search}"/></svg></main>`)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
  }finally{await browser.close()}
})

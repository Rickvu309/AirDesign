import {chromium} from "playwright"
import {readFile,mkdtemp,mkdir,copyFile,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {expect,it} from "vitest"
import {assertRendered,assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {readRegistry,validateIdentity,seedFiles} from "./registry.ts"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"
import {compareDesign} from "./metric.mjs"

it("proves real paint despite perfect canvas pixels and working invisible controls",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,structure:{icons:[],textRoles:[]}}}
  const design=await readFile(entry.design),browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<style>body{margin:0}main{filter:opacity(0)}canvas{position:fixed;inset:0;pointer-events:none;z-index:-1}</style><canvas width="1470" height="923"></canvas><main><span>AirDesign</span><h1>Recents</h1><button>Commands</button><button id="open">Sign out</button><dialog aria-label="Sign out?"><button id="close">Cancel</button></dialog></main><script>document.querySelector('#open').onclick=()=>document.querySelector('dialog').showModal();document.querySelector('#close').onclick=()=>document.querySelector('dialog').close()</script>`)
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
  const entry={...original,assertions:{...original.assertions,copyKeys:[],texts:[],controls:[],structure:{icons:[{region:"main",name:"search"}],textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    const content=`<main><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black"><path d="${iconPaths.search}"/></svg></main>`
    await page.setContent(content)
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    await page.locator("path").evaluate(element=>element.setAttribute("d",element.getAttribute("d")!.replaceAll("21","21.0")))
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    for(const mutation of ["document.querySelector('path').setAttribute('d','M2 2L16 16M16 2L2 16')","document.querySelector('svg').setAttribute('viewBox','0 0 20 20')","document.querySelector('path').setAttribute('transform','rotate(90 12 12)')","document.querySelector('path').style.d='path(\"M2 2L16 16M16 2L2 16\")'","document.querySelector('svg').style.transform='rotate(90deg)'"]){
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

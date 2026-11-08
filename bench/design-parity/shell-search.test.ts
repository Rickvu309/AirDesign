import path from "node:path"
import {build} from "vite"
import {chromium} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {assertScenarioDOM} from "./dom-assertions.ts"
import {parseRegistry,readRegistry} from "./registry.ts"
import {iconPaths} from "../../packages/ui/src/icon/icon-paths.ts"

let shellScript="",shellStyles=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:shell-search-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"shell-search-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement,useState} from "react";import {createRoot} from "react-dom/client";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";function Shell(){const [search,setSearch]=useState("strategy");return createElement(StudioShell,{intentLabel:"Home",showIntent:false,onSignOut:()=>{},search,onSearch:setSearch,starredDecks:[]},createElement("h1",null,"Recents"))}createRoot(document.getElementById("root")).render(createElement(Shell));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ShellSearchProof"}}})
  const outputs=Array.isArray(built) ? built : [built]
  const files=outputs.flatMap(output=>"output" in output ? output.output : [])
  shellScript=files.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  shellStyles=files.filter(output=>output.type==="asset"&&output.fileName.endsWith(".css")).map(output=>typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)).join("\n")
})

it("requires the real sidebar Search searchbox and rejects its absence",async()=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const controls=original.assertions.controls.filter(control=>control.role==="searchbox"||"nameKey" in control&&control.nameKey==="shell.command")
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls,structure:{icons:[],textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage()
    page.setDefaultTimeout(2000)
    const errors:string[]=[]
    page.on("pageerror",error=>errors.push(error.stack??error.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({content:shellScript})
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
    expect(errors).toEqual([])
    const search=page.getByRole("searchbox",{name:"Search",exact:true})
    await search.waitFor()
    expect(controls).toEqual([{role:"searchbox",name:"Search"}])
    await expect(assertScenarioDOM(page,{...entry,assertions:{...entry.assertions,controls:[{role:"button",nameKey:"shell.command"}]}})).rejects.toThrow("required-control")
    await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    await search.evaluate(element=>element.remove())
    await expect(assertScenarioDOM(page,entry)).rejects.toThrow("required-control")
    expect(()=>parseRegistry([{...original,assertions:{...original.assertions,controls:[{role:"searchbox",name:"Commands"}]}}])).toThrow()
    expect(()=>parseRegistry([{...original,assertions:{...original.assertions,controls:[{role:"button",name:"Search"}]}}])).toThrow()
  }finally{await browser.close()}
})

it("dismisses Ctrl and Meta K palettes and restores Search focus and value",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage()
    page.setDefaultTimeout(2000)
    const errors:string[]=[]
    page.on("pageerror",error=>errors.push(error.stack??error.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({content:shellScript})
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
    expect(errors).toEqual([])
    const search=page.getByRole("searchbox",{name:"Search",exact:true})
    await search.fill("revenue")
    await page.evaluate(()=>{const button=document.createElement("button");button.textContent="Proof opener";document.body.append(button)})
    for(const opener of [search,page.getByRole("button",{name:"Proof opener",exact:true})]){
    for(const shortcut of ["Control+k","Meta+k"]){
      await opener.focus()
      await page.keyboard.press(shortcut)
      const dialog=page.getByRole("dialog",{name:"Commands",exact:true})
      await dialog.waitFor()
      expect(await dialog.getByRole("combobox").evaluate(element=>element===document.activeElement)).toBe(true)
      await page.keyboard.press("Escape")
      await dialog.waitFor({state:"hidden"})
      await expect.poll(()=>opener.evaluate(element=>element.isConnected&&element===document.activeElement)).toBe(true)
      expect(await search.inputValue()).toBe("revenue")
    }
    }
  }finally{await browser.close()}
})


it("owns every shared Search icon contract in the actual sidebar SearchField",async()=>{
  const entries=await readRegistry(),icons=entries.flatMap(entry=>entry.assertions.structure.icons.filter(icon=>icon.name==="search"))
  expect(icons).toHaveLength(10)
  expect(icons).toEqual(Array.from({length:10},()=>({region:".ad-sidebar .ad-search",name:"search",size:16,color:"gray.500"})))
})

it.each(["present","missing","wrong"])("finds the actual Shell SearchField icon and rejects %s icon gaps",async state=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:original.assertions.controls.filter(control=>control.role==="searchbox"),structure:{icons:original.assertions.structure.icons,textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    page.setDefaultTimeout(1000)
    await page.setContent('<div id="root"></div>')
    await page.addStyleTag({content:shellStyles})
    await page.addScriptTag({content:shellScript})
    await page.getByRole("searchbox",{name:"Search",exact:true}).waitFor()
    const icon=page.locator('.ad-sidebar .ad-search svg[data-icon="search"]')
    expect(await icon.count()).toBe(1)
    expect(await page.locator('.ad-main svg[data-icon="search"]').count()).toBe(0)
    expect(await icon.locator("path").getAttribute("d")).toBe(iconPaths.search)
    expect(await icon.getAttribute("width")).toBe("16")
    expect(await icon.getAttribute("height")).toBe("16")
    for(const contract of entry.assertions.structure.icons)expect(await page.locator(contract.region).locator(`svg[data-icon="${contract.name}"]`).evaluate(element=>element.closest("label")?.querySelector("input")?.getAttribute("aria-label"))).toBe("Search")
    const misplaced={...entry,assertions:{...entry.assertions,structure:{...entry.assertions.structure,icons:entry.assertions.structure.icons.map(value=>({...value,region:".workspace-home"}))}}}
    await expect(assertScenarioDOM(page,misplaced)).rejects.toThrow("required-icon")
    if(state==="missing")await icon.evaluate(element=>element.remove())
    if(state==="wrong")await icon.evaluate(element=>element.setAttribute("data-icon","trash"))
    if(state!=="present")await expect(assertScenarioDOM(page,entry)).rejects.toThrow("required-icon")
  }finally{await browser.close()}
})

it.each([
  ["canonical","pass"],
  ["missing","required-icon"],
  ["wrong-name","required-icon"],
  ["wrong-size","icon-size"],
  ["wrong-color","icon-color"],
  ["wrong-ink","icon-color"],
  ["wrong-stroke","icon-color"],
  ["wrong-geometry","icon-geometry"]
])("retains strict Search SVG checks in a canonical contract fixture: %s",async(state,check)=>{
  const original=(await readRegistry()).find(entry=>entry.code==="S31.02")!
  const entry={...original,assertions:{...original.assertions,copyKeys:[],controls:original.assertions.controls.filter(control=>control.role==="searchbox"),structure:{icons:original.assertions.structure.icons,textRoles:[]}}}
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport})
    await page.setContent(`<style>body{background:white;color:#222}input{font:14px Geist}</style><aside class="ad-sidebar"><label class="ad-search"><svg data-icon="search" width="16" height="16" viewBox="0 0 24 24"><path d="${iconPaths.search}" stroke="#909090" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><input type="search" aria-label="Search" placeholder="Search"/></label></aside><main class="workspace-home"></main>`)
    const icon=page.locator('svg[data-icon="search"]')
    if(state==="missing")await icon.evaluate(element=>element.remove())
    if(state==="wrong-name")await icon.evaluate(element=>element.setAttribute("data-icon","trash"))
    if(state==="wrong-size")await icon.evaluate(element=>element.setAttribute("width","24"))
    if(state==="wrong-color")await icon.locator("path").evaluate(element=>element.style.stroke="rgb(255, 0, 0)")
    if(state==="wrong-ink")await icon.locator("path").evaluate(element=>element.style.stroke="rgb(34, 34, 34)")
    if(state==="wrong-stroke")await icon.locator("path").evaluate(element=>element.setAttribute("stroke-width","1.6"))
    if(state==="wrong-geometry")await icon.locator("path").evaluate(element=>element.setAttribute("d","M2 2L14 14M14 2L2 14"))
    if(state==="canonical")await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
    else await expect(assertScenarioDOM(page,entry)).rejects.toThrow(check)
  }finally{await browser.close()}
})

it.each([{width:1470,height:923},{width:390,height:844}])("preserves the declared Search SVG size under actual Shell CSS at $width",async viewport=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport})
    await page.setContent('<div id="root"></div>')
    await page.addStyleTag({content:shellStyles})
    await page.addScriptTag({content:shellScript})
    await page.getByRole("searchbox",{name:"Search",exact:true}).waitFor()
    const icon=page.locator('.ad-sidebar .ad-search svg[data-icon="search"]')
    const appearance=await icon.evaluate(element=>{
      const box=element.getBoundingClientRect(),path=element.querySelector("path")!
      return {width:box.width,height:box.height,stroke:getComputedStyle(path).stroke}
    })
    expect(appearance).toEqual({width:16,height:16,stroke:"rgb(144, 144, 144)"})
    const search=page.getByRole("searchbox",{name:"Search",exact:true})
    await search.fill("long query retained while the icon keeps its declared dimensions")
    expect(await search.inputValue()).toBe("long query retained while the icon keeps its declared dimensions")
    expect(await icon.boundingBox()).toMatchObject({width:16,height:16})
  }finally{await browser.close()}
})

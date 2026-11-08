import path from "node:path"
import {build} from "vite"
import {chromium} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {assertScenarioDOM} from "./dom-assertions.ts"
import {parseRegistry,readRegistry} from "./registry.ts"

let shellScript=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:shell-search-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"shell-search-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement,useState} from "react";import {createRoot} from "react-dom/client";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";function Shell(){const [search,setSearch]=useState("strategy");return createElement(StudioShell,{intentLabel:"Home",showIntent:false,onSignOut:()=>{},search,onSearch:setSearch,starredDecks:[]},createElement("h1",null,"Recents"))}createRoot(document.getElementById("root")).render(createElement(Shell));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ShellSearchProof"}}})
  const outputs=Array.isArray(built) ? built : [built]
  shellScript=outputs.flatMap(output=>"output" in output ? output.output : []).filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
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

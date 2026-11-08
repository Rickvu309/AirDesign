import path from "node:path"
import {readFile} from "node:fs/promises"
import {createHash} from "node:crypto"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {assertScenarioControls,assertScenarioStructure,assertScenarioDOM} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"
import type {ExportJob} from "../../apps/server/src/decks/export-store.ts"
let script="",styles=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:settings-export-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"settings-export-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement,useState} from "react";import {createRoot} from "react-dom/client";import {ExportDialog} from "${path.resolve("apps/studio/src/export/export-dialog.tsx")}";import {fixtureDeck} from "${path.resolve("packages/deck/src/fixture.ts")}";import {Toaster} from "${path.resolve("packages/ui/src/index.ts")}";import "${path.resolve("apps/studio/src/settings/settings.css")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";function Proof(){const[open,setOpen]=useState(true);return createElement("div",null,createElement(ExportDialog,{deck:fixtureDeck(1),seq:0,open,close:()=>setOpen(false),fix:()=>{},disabled:false}),createElement(Toaster))}createRoot(document.getElementById("root")).render(createElement(Proof));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"SettingsExportProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})

async function mount(page:Page,attempts:number,retry:"queued"|"rejected"="queued",state:"failed"|"queued"|"ready"="failed"){
  const requests:string[]=[]
  const job:ExportJob={id:"export-proof",deck:fixtureDeck(1).id,format:"pptx",attempts,options:{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false},diagnostics:["SIGKILL: retained raw diagnostic"],kind:"failed",reason:"private",failure:{kind:"limit",limit:"wall-clock",signal:"SIGKILL"}}
  const artifact=await writeSavedPptx(fixtureDeck(1),0,null,{})
  let current:ExportJob=state==="ready" ? {...job,kind:"ready",seq:0,sha256:createHash("sha256").update(artifact).digest("hex"),expires:Date.now()+60000,report:{}} : state==="queued" ? {...job,kind:"queued",diagnostics:[]} : job
  await page.route("http://export-proof.test/**",route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.pathname==="/")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
    if(url.pathname.endsWith("/artifact"))return route.fulfill({contentType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",headers:{"content-disposition":'attachment; filename="Q3 Investor Update-v3.pptx"'},body:Buffer.from(artifact)})
    if(request.method()==="POST"){
      requests.push(url.pathname)
      if(retry==="rejected")return route.fulfill({status:503,json:{code:"unavailable"}})
      current={...job,kind:"queued"}
      return route.fulfill({json:current})
    }
    return route.fulfill({json:[current]})
  })
  await page.goto("http://export-proof.test/")
  await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
  if(state==="failed")await page.getByRole("region",{name:"Notifications"}).getByText("Unable to export. Your deck is unchanged.",{exact:true}).waitFor()
  else await page.getByRole("dialog",{name:"Export",exact:true}).waitFor()
  return {requests,artifact}
}

it("keeps typed recovery and raw Details accessible after closing the failed export",async()=>{
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage(),{requests}=await mount(page,1)
  await page.getByRole("dialog").waitFor({state:"hidden"})
  expect(await page.getByText("SIGKILL: retained raw diagnostic",{exact:true}).isVisible()).toBe(false)
  await page.getByRole("button",{name:"Details",exact:true}).click()
  const dialog=page.getByRole("dialog",{name:"Export",exact:true})
  await dialog.waitFor()
  expect(await dialog.locator("details").evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(true)
  expect(await dialog.getByText("SIGKILL: retained raw diagnostic",{exact:true}).isVisible()).toBe(true)
  await dialog.getByRole("button",{name:"Retry export",exact:true}).click()
  expect(requests).toEqual(["/api/catalog/export-jobs/export-proof/retry"])
  await dialog.getByText("Export queued. You can close this tab and return here.",{exact:true}).waitFor()
 }finally{await browser.close()}
})

it("retains failed retry recovery and excludes retry after three attempts",async()=>{
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage(),{requests}=await mount(page,1,"rejected")
  await page.getByRole("button",{name:"Try again",exact:true}).click()
  await page.getByText("Unable to retry this export. Open Export to try again.",{exact:true}).waitFor()
  expect(requests).toEqual(["/api/catalog/export-jobs/export-proof/retry"])
  await page.close()
  const exhausted=await browser.newPage();await mount(exhausted,3)
  expect(await exhausted.getByRole("button",{name:"Try again",exact:true}).count()).toBe(0)
  await exhausted.getByRole("button",{name:"Details",exact:true}).click()
  expect(await exhausted.getByRole("button",{name:"Retry export",exact:true}).count()).toBe(0)
 }finally{await browser.close()}
})


it("verifies the real export format and owning open dialog with independent wrong-value and hidden controls",async()=>{
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage();await mount(page,1,"queued","queued")
  for(const code of ["S61.01","S61.02"]){
   const entry=(await readRegistry()).find(entry=>entry.code===code)
   if(!entry)throw new Error("missing-export-contract")
   const select=page.getByRole("combobox",{name:"File format",exact:true})
   await select.selectOption(code==="S61.02" ? "pdf" : "pptx")
   await expect(assertScenarioControls(page,entry)).resolves.toBeUndefined()
   await select.selectOption(code==="S61.02" ? "pptx" : "pdf")
   await expect(assertScenarioControls(page,entry)).rejects.toThrow("required-native-selection")
   await select.selectOption(code==="S61.02" ? "pdf" : "pptx")
   await select.evaluate(element=>element.style.visibility="hidden")
   await expect(assertScenarioControls(page,entry)).rejects.toThrow()
   await page.locator('.export-dialog select[aria-label="File format"]').evaluate(element=>element.style.removeProperty("visibility"))
   await expect(assertScenarioControls(page,entry)).resolves.toBeUndefined()
  }
 }finally{await browser.close()}
})

for(const code of ["S61.01","S61.02","S69.01"]){
 it("enforces the source-owned title paint for "+code,async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code===code)
  if(!entry)throw new Error("missing-export-entry")
  const browser=await chromium.launch()
  try{
   const page=await browser.newPage();await mount(page,1,"queued",code==="S69.01"?"failed":"queued")
   await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished))})
   await expect(assertScenarioStructure(page,entry)).resolves.toBeUndefined()
   const title=page.locator(code==="S69.01"?"[data-sonner-toast] [data-title]":".export-dialog h2")
   const original=await title.getAttribute("style")
   try{
    for(const [property,value] of [["font-size","30px"],["font-weight","900"],["color","rgb(120, 120, 120)"],["visibility","hidden"]]){
     if(!property||!value)throw new Error("missing-style-mutation")
     await title.evaluate((element,input)=>element.style.setProperty(input.property,input.value,"important"),{property,value})
     await expect(assertScenarioStructure(page,entry)).rejects.toThrow()
     await title.evaluate((element,value)=>value===null?element.removeAttribute("style"):element.setAttribute("style",value),original)
    }
   }finally{await title.evaluate((element,value)=>value===null?element.removeAttribute("style"):element.setAttribute("style",value),original)}
   await expect(assertScenarioStructure(page,entry)).resolves.toBeUndefined()
  }finally{await browser.close()}
 })
}

it("asserts the owned completed toast only after a real byte-identical PPTX browser download",async()=>{
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage(),{artifact}=await mount(page,1,"queued","ready")
  const pending=page.waitForEvent("download")
  await page.getByRole("link",{name:"Download PPTX",exact:true}).click()
  const download=await pending,file=await download.path()
  if(!file)throw new Error("missing-browser-artifact")
  expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toBe("Q3 Investor Update-v3.pptx")
  const actual=await readFile(file),expected=artifact
  expect(actual.equals(Buffer.from(expected))).toBe(true)
  expect(createHash("sha256").update(actual).digest("hex")).toBe(createHash("sha256").update(expected).digest("hex"))
  await page.getByRole("dialog").waitFor({state:"hidden"})
  await page.locator("[data-sonner-toast] [data-title]").waitFor()
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(animation=>animation.finished))})
  const entry=(await readRegistry()).find(entry=>entry.code==="S61.03");if(!entry)throw new Error("missing-completed-export-entry")
  await expect(assertScenarioDOM(page,entry)).resolves.toBeUndefined()
  await page.locator("[data-sonner-toast]").evaluate(element=>{document.body.append(element.querySelector("[data-title]")??document.createTextNode(""));element.remove()})
  await expect(assertScenarioDOM(page,entry)).rejects.toThrow("required-toast-owner")
 }finally{await browser.close()}
})

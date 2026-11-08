import path from "node:path"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {assertScenarioControls} from "./dom-assertions.ts"
import {readRegistry} from "./registry.ts"
import type {ExportJob} from "../../apps/server/src/decks/export-store.ts"
let script="",styles=""
beforeAll(async()=>{
  const entry=path.resolve("virtual:settings-export-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"settings-export-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement,useState} from "react";import {createRoot} from "react-dom/client";import {ExportDialog} from "${path.resolve("apps/studio/src/export/export-dialog.tsx")}";import {fixtureDeck} from "${path.resolve("packages/deck/src/fixture.ts")}";import {Toaster} from "${path.resolve("packages/ui/src/index.ts")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";function Proof(){const[open,setOpen]=useState(true);return createElement("div",null,createElement(ExportDialog,{deck:fixtureDeck(1),seq:0,open,close:()=>setOpen(false),fix:()=>{},disabled:false}),createElement(Toaster))}createRoot(document.getElementById("root")).render(createElement(Proof));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"SettingsExportProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})

async function mount(page:Page,attempts:number,retry:"queued"|"rejected"="queued",state:"failed"|"queued"="failed"){
  const requests:string[]=[]
  const job:ExportJob={id:"export-proof",deck:fixtureDeck(1).id,format:"pptx",attempts,options:{format:"pptx",slides:[],timing:"now",expectedSeq:0,allowIssues:false},diagnostics:["SIGKILL: retained raw diagnostic"],kind:"failed",reason:"private",failure:{kind:"limit",limit:"wall-clock",signal:"SIGKILL"}}
  let current:ExportJob=state==="queued" ? {...job,kind:"queued"} : job
  await page.route("http://export-proof.test/**",route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.pathname==="/")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
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
  return requests
}

it("keeps typed recovery and raw Details accessible after closing the failed export",async()=>{
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage(),requests=await mount(page,1)
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
  const page=await browser.newPage(),requests=await mount(page,1,"rejected")
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

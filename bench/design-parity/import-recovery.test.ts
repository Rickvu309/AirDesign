import path from "node:path"
import {readFile} from "node:fs/promises"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {operationId,type Operation} from "../../packages/operations/src/index.ts"
import type {DeckEntry} from "../../packages/catalog/src/index.ts"

let script="",styles=""
const oldId=operationId("11111111-1111-4111-8111-111111111111"),freshId=operationId("22222222-2222-4222-8222-222222222222")
const ownKey=JSON.stringify(["import","ada"]),otherKey=JSON.stringify(["import","grace"])
const reason="zip-central-directory-missing: controlled diagnostic"
const fixture=path.resolve("fixtures/pptx/native.pptx")
beforeAll(async()=>{
  const entry=path.resolve("virtual:import-recovery-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"import-recovery-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {Workspace} from "${path.resolve("apps/studio/src/decks/workspace.tsx")}";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(StudioShell,{intentLabel:"",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:[]},createElement(Workspace)));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"ImportRecoveryProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})

async function workspace(page:Page){
  const uploads:{requestId:string;base64:string}[]=[],imports:unknown[]=[],errors:string[]=[],navigations:string[]=[]
  const sibling:DeckEntry={id:"atlas",title:"Project Atlas",updated:1762484400000,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:8,starred:false,preview:null}
  const retained:DeckEntry={...sibling,id:"retained-import",title:"native"}
  const failed:Operation={id:oldId,attempts:1,kind:"failed",reason}
  const queued:Operation={id:freshId,attempts:0,kind:"queued"}
  const running:Operation={id:freshId,attempts:1,kind:"running",progress:{kind:"unavailable"},lease:"controlled-browser-lease"}
  const ready:Operation={id:freshId,attempts:1,kind:"ready",sha256:"a".repeat(64),expires:4102444800000,report:{capabilities:[]}}
  let complete=false
  page.setDefaultTimeout(2000)
  page.on("pageerror",error=>errors.push(error.message))
  page.on("requestfailed",request=>errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`))
  await page.addInitScript(({ownKey,otherKey,oldId})=>{
    if(location.pathname!=="/")return
    localStorage.setItem(ownKey,oldId)
    localStorage.setItem(ownKey+"title","Failed board proposal")
    localStorage.setItem(otherKey,"other-person-operation")
    localStorage.setItem(otherKey+"title","Other person file")
  },{ownKey,otherKey,oldId})
  await page.route("http://localhost:4179/**",async route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.pathname==="/")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
    if(url.pathname==="/deck/retained-import"){navigations.push(url.pathname);return route.fulfill({contentType:"text/html",body:"<title>Controlled navigation boundary</title>"})}
    if(url.pathname==="/api/account")return route.fulfill({json:{status:"signed-in",personId:"ada"}})
    if(url.pathname==="/api/catalog"&&request.method()==="GET")return route.fulfill({json:imports.length ? [sibling,retained] : [sibling]})
    if(url.pathname===`/api/operations/${oldId}`&&request.method()==="GET")return route.fulfill({json:failed})
    if(url.pathname==="/api/operations"&&request.method()==="POST"){
      const body:unknown=request.postDataJSON()
      if(!body||typeof body!=="object"||!("requestId" in body)||typeof body.requestId!=="string"||!("base64" in body)||typeof body.base64!=="string")throw new Error("invalid-browser-upload-body")
      uploads.push({requestId:body.requestId,base64:body.base64})
      return route.fulfill({json:queued})
    }
    if(url.pathname===`/api/operations/${freshId}`&&request.method()==="GET")return route.fulfill({json:complete ? ready : running})
    if(url.pathname==="/api/catalog/import"&&request.method()==="POST"){imports.push(request.postDataJSON());return route.fulfill({json:{entry:retained}})}
    errors.push(request.method()+" "+url.pathname)
    return route.fulfill({status:500,json:{code:"unexpected-import-proof-request"}})
  })
  await page.goto("http://localhost:4179/")
  await page.addStyleTag({content:styles})
  await page.addScriptTag({content:script})
  await page.locator('.import-card[data-import-state="failed"]').waitFor()
  await page.getByRole("heading",{name:"Project Atlas",exact:true}).waitFor()
  return {uploads,imports,errors,navigations,sibling,complete:()=>{complete=true}}
}

async function persistence(page:Page){return page.evaluate(({ownKey,otherKey})=>({own:localStorage.getItem(ownKey),title:localStorage.getItem(ownKey+"title"),other:localStorage.getItem(otherKey),otherTitle:localStorage.getItem(otherKey+"title")}),{ownKey,otherKey})}

it("reveals real failed-import Details by keyboard and uploads fresh selected bytes before explicit keep",async()=>{
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
  try{
    const proof=await workspace(page),card=page.locator(".import-card"),sibling=page.locator('.deck-card:has(h2:has-text("Project Atlas"))')
    const originalSibling=await sibling.innerHTML(),details=card.locator("details.import-diagnostics"),summary=details.locator("summary"),diagnostic=details.locator("pre")
    expect(await card.locator(".import-filename").innerText()).toBe("Failed board proposal")
    expect(await card.getByRole("status").innerText()).toBe("Unable to import")
    expect(await details.evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(false)
    expect(await diagnostic.isVisible()).toBe(false)
    await card.getByRole("button",{name:"Choose another file",exact:true}).focus()
    await page.keyboard.press("Tab")
    expect(await card.getByRole("button",{name:"Remove",exact:true}).evaluate(element=>element===document.activeElement)).toBe(true)
    await page.keyboard.press("Tab")
    expect(await summary.evaluate(element=>element===document.activeElement)).toBe(true)
    await page.keyboard.press("Enter")
    expect(await diagnostic.isVisible()).toBe(true)
    expect(await diagnostic.innerText()).toBe(reason)
    await page.keyboard.press("Space")
    expect(await details.evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(false)
    expect(await diagnostic.isVisible()).toBe(false)
    const chooser=page.waitForEvent("filechooser")
    await card.getByRole("button",{name:"Choose another file",exact:true}).click()
    const fileChooser=await chooser
    expect(await fileChooser.element().getAttribute("aria-label")).toBe("Import PowerPoint")
    const submitted=page.waitForRequest(request=>new URL(request.url()).pathname==="/api/operations"&&request.method()==="POST")
    await fileChooser.setFiles(fixture)
    await submitted
    await card.getByRole("status").filter({hasText:"Importing PowerPoint…"}).waitFor()
    await card.getByRole("button",{name:"Cancel import",exact:true}).waitFor()
    expect(proof.uploads,"selected file must produce one fresh upload").toHaveLength(1)
    const upload=proof.uploads[0]
    if(!upload)throw new Error("missing-fresh-browser-upload")
    expect(upload.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(upload.requestId).not.toBe(oldId)
    expect(freshId).not.toBe(oldId)
    expect(Buffer.from(upload.base64,"base64")).toEqual(await readFile(fixture))
    expect(await persistence(page)).toEqual({own:freshId,title:"native",other:"other-person-operation",otherTitle:"Other person file"})
    expect(await card.locator(".import-filename").innerText()).toBe("native")
    expect(await card.locator(".import-diagnostics").count()).toBe(0)
    expect(await card.getByRole("button",{name:"Keep and open deck",exact:true}).count()).toBe(0)
    expect(proof.imports).toEqual([])
    expect(proof.navigations).toEqual([])
    expect(await sibling.innerHTML()).toBe(originalSibling)
    proof.complete()
    await card.getByRole("status").filter({hasText:"Ready to open"}).waitFor()
    expect(proof.imports).toEqual([])
    expect(proof.navigations).toEqual([])
    expect(await sibling.innerHTML()).toBe(originalSibling)
    await card.getByRole("button",{name:"Keep and open deck",exact:true}).click()
    await page.waitForURL("http://localhost:4179/deck/retained-import")
    expect(proof.imports).toEqual([{operation:freshId,requestId:`import_${freshId}`,title:"native"}])
    expect(proof.navigations).toEqual(["/deck/retained-import"])
    expect(await persistence(page)).toEqual({own:null,title:null,other:"other-person-operation",otherTitle:"Other person file"})
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

it("removes only the current account failed import while preserving another account and sibling deck",async()=>{
  const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}})
  try{
    const proof=await workspace(page),sibling=page.locator('.deck-card:has(h2:has-text("Project Atlas"))'),originalSibling=await sibling.innerHTML()
    expect(await persistence(page)).toEqual({own:oldId,title:"Failed board proposal",other:"other-person-operation",otherTitle:"Other person file"})
    await page.locator(".import-card").getByRole("button",{name:"Remove",exact:true}).click()
    await page.locator(".import-card").waitFor({state:"detached"})
    expect(await persistence(page),"Remove must clear current-account import id and title").toEqual({own:null,title:null,other:"other-person-operation",otherTitle:"Other person file"})
    expect(await sibling.innerHTML()).toBe(originalSibling)
    expect(proof.uploads).toEqual([])
    expect(proof.imports).toEqual([])
    expect(proof.navigations).toEqual([])
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

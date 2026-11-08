import path from "node:path"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {perform} from "./capture.mjs"
import {readRegistry} from "./registry.ts"
import {assertRendered,assertScenarioCopy,assertDialogActions} from "./dom-assertions.ts"
import type {DeckEntry} from "../../packages/catalog/src/index.ts"

let script="",styles=""
const title="Pricing Strategy Review"
const card='.deck-card:has(h2:has-text("Pricing Strategy Review"))'
beforeAll(async()=>{
  const entry=path.resolve("virtual:decks-trash-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"decks-trash-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {Toaster} from "@airdesign/ui";import {Workspace} from "${path.resolve("apps/studio/src/decks/workspace.tsx")}";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(StudioShell,{intentLabel:"",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:[]},createElement(Workspace),createElement(Toaster)));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"DecksTrashProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
})

async function workspace(page:Page,trash=false){
  const posts:string[]=[],errors:string[]=[]
  let removed=false,emptied=false
  const deletions:{path:string;body:unknown}[]=[]
  const decks:DeckEntry[]=[{id:"pricing",title,updated:1762484400000,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:8,starred:false,preview:null},{id:"atlas",title:"Project Atlas",updated:1762484400000,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:8,starred:false,preview:null}]
  if(trash){
    decks.push({id:"draft",title:"Old pitch draft",updated:1762484400000,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:4,starred:false,preview:null})
    decks.forEach((deck,index)=>{deck.deletedAt=1762484400000;deck.generation=index+2})
  }
  const target=decks[0]
  if(!target)throw new Error("missing-trash-fixture-deck")
  page.setDefaultTimeout(700)
  page.on("pageerror",error=>errors.push(error.message))
  await page.route("http://deck-proof.test/**",async route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.pathname==="/"||url.pathname==="/trash")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
    if(url.pathname==="/api/account")return route.fulfill({json:{status:"signed-in",personId:"ada"}})
    if(url.pathname==="/api/catalog"&&request.method()==="GET")return route.fulfill({json:emptied ? [] : removed ? decks.slice(1) : decks})
    if(url.pathname==="/api/catalog/pricing/trash"&&request.method()==="POST"){posts.push(url.pathname);removed=true;return route.fulfill({json:{...target,deletedAt:1762484400000}})}
    if(url.pathname==="/api/catalog/trash"&&request.method()==="DELETE"){deletions.push({path:url.pathname,body:request.postDataJSON()});emptied=true;return route.fulfill({json:{deleted:decks.length}})}
    errors.push(request.method()+" "+url.pathname)
    return route.fulfill({status:500,json:{code:"unexpected-proof-request"}})
  })
  await page.goto(`http://deck-proof.test/${trash ? "trash" : ""}`)
  await page.addStyleTag({content:styles})
  await page.addScriptTag({content:script})
  await page.getByRole("heading",{name:title,exact:true}).waitFor()
  return {posts,errors,deletions,decks}
}

it("reaches Trash through the visible card menu and real confirmation",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.01")
  if(!entry||entry.status!=="reachable")throw new Error("missing-trash-journey")
  const [menu,action]=entry.steps
  if(menu?.kind!=="selector-click"||action?.kind!=="selector-click")throw new Error("missing-trash-menu-steps")
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport}),proof=await workspace(page)
    await perform(page,menu,undefined,undefined)
    expect(await page.locator(card+" details").evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(true)
    expect(proof.posts).toEqual([])
    await perform(page,action,undefined,undefined)
    await page.getByRole("dialog",{name:"Move deck to Trash?",exact:true}).waitFor()
    expect(proof.posts).toEqual([])
    await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click()
    expect(proof.posts).toEqual([])
    await perform(page,menu,undefined,undefined)
    await perform(page,action,undefined,undefined)
    for(const step of entry.steps.slice(2)){
      if(step.kind!=="dialog-click"&&step.kind!=="wait-text")throw new Error("unexpected-trash-confirmation-step")
      await perform(page,step,undefined,undefined)
    }
    expect(proof.posts).toEqual(["/api/catalog/pricing/trash"])
    expect(await page.getByRole("dialog").count()).toBe(0)
    expect(await page.getByRole("heading",{name:title,exact:true}).count()).toBe(0)
    expect(await page.getByRole("heading",{name:"Project Atlas",exact:true}).count()).toBe(1)
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

it.each(["menu","action"])("rejects a missing required card %s without moving a deck",async missing=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.01")
  if(!entry||entry.status!=="reachable")throw new Error("missing-trash-journey")
  const [menu,action]=entry.steps
  if(menu?.kind!=="selector-click"||action?.kind!=="selector-click")throw new Error("missing-trash-menu-steps")
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport}),proof=await workspace(page)
    if(missing==="menu")await page.locator(card+' summary[aria-label="Actions for Pricing Strategy Review"]').evaluate(element=>element.remove())
    else await page.locator(card+" .ad-menu button").filter({hasText:/^Move to Trash$/}).evaluate(element=>element.remove())
    if(missing==="menu")await expect(perform(page,menu,undefined,undefined)).rejects.toThrow()
    else{
      await perform(page,menu,undefined,undefined)
      await expect(perform(page,action,undefined,undefined)).rejects.toThrow()
    }
    expect(proof.posts).toEqual([])
    expect(await page.getByRole("dialog").count()).toBe(0)
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

it("paints the real permanent-delete label and preserves Cancel and exact snapshot confirmation",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S33.03")
  if(!entry||entry.status!=="reachable")throw new Error("missing-empty-trash-journey")
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport}),proof=await workspace(page,true)
    const expected=proof.decks.map(({id,generation})=>({id,generation}))
    await page.getByRole("button",{name:"Empty Trash",exact:true}).click()
    const dialog=page.getByRole("dialog"),action=dialog.getByRole("button",{name:"Delete for good",exact:true})
    await expect(assertRendered(action,true)).resolves.toBeUndefined()
    await expect(assertScenarioCopy(page,entry.assertions.copyKeys,entry.code,entry.assertions.copyValues)).resolves.toBeUndefined()
    await expect(assertDialogActions(page,entry)).resolves.toBeUndefined()
    expect(await action.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundColor,image:style.backgroundImage,color:style.color}})).toEqual({background:"rgb(217, 63, 63)",image:"none",color:"rgb(255, 255, 255)"})
    expect(proof.deletions).toEqual([])
    await dialog.getByRole("button",{name:"Cancel",exact:true}).click()
    expect(await dialog.count()).toBe(0)
    expect(proof.deletions).toEqual([])
    for(const deck of proof.decks)expect(await page.getByRole("heading",{name:deck.title,exact:true}).count()).toBe(1)
    await page.getByRole("button",{name:"Empty Trash",exact:true}).click()
    expect(proof.deletions).toEqual([])
    await action.click()
    await page.getByRole("heading",{name:"Trash is empty",exact:true}).waitFor()
    expect(proof.deletions).toEqual([{path:"/api/catalog/trash",body:{confirm:"empty-trash",decks:expected}}])
    expect(proof.posts).toEqual([])
    expect(await dialog.count()).toBe(0)
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

it.each(["missing","hidden"])("rejects a %s permanent-delete action from the real painted baseline",async mutation=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}}),proof=await workspace(page,true)
    await page.getByRole("button",{name:"Empty Trash",exact:true}).click()
    const action=page.locator(".workspace-home .ad-dialog .ad-button-danger")
    await expect(assertRendered(action,true)).resolves.toBeUndefined()
    if(mutation==="missing")await action.evaluate(element=>element.remove())
    else await action.evaluate(element=>element.style.visibility="hidden")
    await expect(assertRendered(action,true)).rejects.toThrow(/required-rendered-element|hit-test|ink-ownership|locator.boundingBox: Timeout/)
    expect(proof.deletions).toEqual([])
    await page.getByRole("dialog").getByRole("button",{name:"Cancel",exact:true}).click()
    for(const deck of proof.decks)expect(await page.getByRole("heading",{name:deck.title,exact:true}).count()).toBe(1)
    expect(proof.errors).toEqual([])
  }finally{await browser.close()}
})

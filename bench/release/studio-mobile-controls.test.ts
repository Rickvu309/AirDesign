import path from "node:path"
import {build} from "vite"
import {chromium,type Page,type Locator} from "playwright"
import {beforeAll,expect,it} from "vitest"

let script="",styles=""
beforeAll(async()=>{
 const entry=path.resolve("virtual:studio-mobile-controls"),hook="virtual:mobile-controlled-snapshot"
 const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"mobile-controlled-snapshot",enforce:"pre",resolveId:(source,importer)=>source===entry ? entry : source==="./use-deck.ts"&&importer?.endsWith("manual-editor.tsx") ? hook : undefined,load:source=>source===hook||source===path.resolve("apps/studio/src/editor/use-deck.ts") ? `import {fixtureDeck} from "${path.resolve("packages/deck/src/fixture.ts")}";const deck=fixtureDeck(1);export function useDeck(){return {sync:{deck,state:{kind:new URL(location.href).searchParams.get("state")||"saved"},seq:0,queue:[],history:{events:[]},historyTarget:()=>null},entry:{title:"Independent mobile deck"},setEntry:()=>{},error:"",setError:()=>{},reconnect:()=>{}}}` : source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {ManualEditor} from "${path.resolve("apps/studio/src/editor/manual-editor.tsx")}";import {Workspace} from "${path.resolve("apps/studio/src/decks/workspace.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(location.pathname==="/editor"?ManualEditor:Workspace,{deckId:"mobile-proof"}));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"StudioMobileControls"}}})
 const outputs=(Array.isArray(built)?built:[built]).flatMap(output=>"output" in output?output.output:[])
 script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
 styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css")?[typeof output.source==="string"?output.source:new TextDecoder().decode(output.source)]:[]).join("\n")
})
async function mount(page:Page,route:string){
 let starred=true
 const requests:string[]=[],errors:string[]=[]
 page.on("pageerror",error=>errors.push(error.message));page.setDefaultTimeout(2000)
 await page.route("http://mobile-proof.test/**",route=>{
  const request=route.request(),url=new URL(request.url())
  if(!url.pathname.startsWith("/api/"))return route.fulfill({contentType:"text/html",body:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'})
  if(request.method()==="POST"){requests.push(url.pathname);starred=false;return route.fulfill({json:{}})}
  return route.fulfill({json:url.pathname==="/api/catalog"?[{id:"mobile-proof",title:"Independent mobile deck",updated:1762484400000,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:0,starred}]:[]})
 })
 await page.goto("http://mobile-proof.test"+route);await page.addStyleTag({content:styles});await page.addScriptTag({content:script})
 return {requests,errors}
}
async function ownsSquare(locator:Locator){
 return locator.evaluate(element=>{
  const r=element.getBoundingClientRect(),left=(r.left+r.right)/2-22,top=(r.top+r.bottom)/2-22
  for(let x=0;x<44;x++)for(let y=0;y<44;y++){const hit=document.elementFromPoint(left+x+.5,top+y+.5);if(!hit||!element.contains(hit))return false}
  return true
 })
}
it("keeps Star and Actions independently tappable and keyboard operable on phone and tablet",async()=>{
 const browser=await chromium.launch()
 try{for(const width of [390,768]){
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true}),proof=await mount(page,"/")
  const star=page.getByRole("button",{name:"Unstar Independent mobile deck",exact:true}),menu=page.locator("article.deck-card summary")
  await star.waitFor();expect(await ownsSquare(star)).toBe(true);expect(await ownsSquare(menu)).toBe(true)
  const box=await star.boundingBox();if(!box)throw new Error("missing-star-box")
  await page.touchscreen.tap(box.x+box.width-.5,box.y+box.height/2)
  await page.getByRole("button",{name:"Star Independent mobile deck",exact:true}).waitFor()
  expect(proof.requests).toEqual(["/api/catalog/mobile-proof/star"])
  await menu.tap();await page.getByRole("button",{name:"Move to Trash",exact:true}).waitFor()
  await menu.focus();await menu.press("Enter");expect(await menu.evaluate(element=>element.closest("details")?.open)).toBe(false)
  await menu.press("Enter");expect(await menu.evaluate(element=>element.closest("details")?.open)).toBe(true)
  expect(proof.errors).toEqual([]);await page.close()
 }}finally{await browser.close()}
})
it("opens Export on the unchanged phone viewport while keeping unsafe snapshots disabled",async()=>{
 const browser=await chromium.launch()
 try{for(const state of ["saved","offline","deleted","signed-out"]){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),proof=await mount(page,"/editor?state="+state)
  const button=page.getByRole("button",{name:"Export",exact:true});await button.waitFor()
  expect(await button.isEnabled(),JSON.stringify({state,dom:await page.locator(".studio-editor").getAttribute("data-sync-state"),errors:proof.errors})).toBe(state==="saved")
  if(state==="saved"){
   expect(await ownsSquare(button)).toBe(true);await button.tap()
   const dialog=page.getByRole("dialog",{name:"Export",exact:true});await dialog.waitFor()
   expect(await dialog.getByRole("button",{name:"Export",exact:true}).isEnabled()).toBe(true)
   expect(page.viewportSize()).toEqual({width:390,height:844});expect(proof.requests).toEqual([])
   await dialog.getByRole("button",{name:"Close export",exact:true}).press("Enter");await dialog.waitFor({state:"hidden"})
  }
  expect(proof.errors).toEqual([]);await page.close()
 }}finally{await browser.close()}
})
it("keeps tablet view and design controls independently owned",async()=>{
 const browser=await chromium.launch()
 try{
  const page=await browser.newPage({viewport:{width:768,height:844},hasTouch:true,isMobile:true}),proof=await mount(page,"/editor")
  const single=page.getByRole("button",{name:"Single slide view",exact:true}),grid=page.getByRole("button",{name:"Grid view",exact:true})
  await single.waitFor();expect(await ownsSquare(single)).toBe(true);expect(await ownsSquare(grid)).toBe(true)
  await single.tap();expect(await single.getAttribute("aria-pressed")).toBe("true")
  await grid.focus();await grid.press("Enter");expect(await grid.getAttribute("aria-pressed")).toBe("true")
  for(const name of ["Select slides","Edit slide text","Images","Agent","Design"])expect(await ownsSquare(page.getByRole("button",{name,exact:true})),name+JSON.stringify(await page.getByRole("button",{name,exact:true}).boundingBox())).toBe(true)
  expect(proof.errors).toEqual([])
 }finally{await browser.close()}
})

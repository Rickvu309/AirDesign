import path from "node:path"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import type {DeckEntry} from "../../packages/catalog/src/index.ts"

let script="",styles=""
const deck=fixtureDeck(1),title="Independent customer research"
const decks:DeckEntry[]=[false,true].map((portrait,index)=>({id:`research-${index}`,title:`${title} ${index}`,updated:1762484400000-index,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:1,starred:true,preview:{slide:{...deck.slides[0],size:portrait ? {width:540,height:960} : deck.slides[0].size},themes:deck.themes}}))
beforeAll(async()=>{
  const entry=path.resolve("virtual:decks-grid-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"decks-grid-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {Workspace} from "${path.resolve("apps/studio/src/decks/workspace.tsx")}";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(StudioShell,{intentLabel:"",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:[]},createElement(Workspace)));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"DecksGridProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.filter(output=>output.type==="asset"&&output.fileName.endsWith(".css")).map(output=>typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)).join("\n")
})

async function workspace(page:Page,browse="recent"){
  const errors:string[]=[]
  page.on("pageerror",error=>errors.push(error.message))
  page.setDefaultTimeout(1500)
  await page.route("http://grid-proof.test/**",async route=>{
    const url=new URL(route.request().url())
    if(url.pathname==="/")return route.fulfill({contentType:"text/html",body:'<div id="root"></div>'})
    if(url.pathname==="/api/account")return route.fulfill({json:{status:"signed-in",personId:"ada"}})
    if(url.pathname==="/api/catalog")return route.fulfill({json:decks})
    errors.push(route.request().method()+" "+url.pathname)
    return route.fulfill({status:500,json:{code:"unexpected-proof-request"}})
  })
  await page.goto(`http://grid-proof.test/${browse==="all" ? "?browse=all" : ""}`)
  await page.addStyleTag({content:styles})
  await page.addScriptTag({content:script})
  await page.getByRole("heading",{name:decks[0].title,exact:true}).waitFor()
  return errors
}

it.each(["recent","all"])("frames %s cards with the designed spacing and real landscape/portrait previews",async browse=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}}),errors=await workspace(page,browse)
    const measurements=await page.locator(".deck-card").evaluateAll(cards=>cards.map(card=>{
      const cover=card.querySelector(".deck-cover")!,canvas=card.querySelector(".deck-preview-canvas")!,box=card.getBoundingClientRect(),preview=cover.getBoundingClientRect(),slide=canvas.getBoundingClientRect()
      return {offset:preview.y-box.y,height:preview.height,contained:slide.width<=preview.width+0.1&&slide.height<=preview.height+0.1,ratio:slide.width/slide.height,text:canvas.textContent}
    }))
    expect(measurements.map(value=>value.offset)).toEqual([65,65])
    expect(measurements.map(value=>value.height)).toEqual([browse==="recent" ? 200 : 180,browse==="recent" ? 200 : 180])
    expect(measurements.map(value=>value.contained)).toEqual([true,true])
    expect(measurements[0].ratio).toBeCloseTo(960/540)
    expect(measurements[1].ratio).toBeCloseTo(540/960)
    expect(measurements.every(value=>value.text?.includes("A clear direction"))).toBe(true)
    expect(await page.locator(".deck-grid").evaluate(element=>getComputedStyle(element).gap)).toBe("20px")
    expect(await page.getByRole("link",{name:`Open ${decks[0].title}`,exact:true}).getAttribute("href")).toBe("/deck/research-0")
    await page.getByRole("button",{name:"List view",exact:true}).click()
    const preview=await page.locator(".deck-cover").first().boundingBox()
    expect(preview?.width).toBe(64)
    expect(preview?.height).toBe(36)
    expect(await page.locator(".deck-created").first().isVisible()).toBe(true)
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

it("uses the primary top-to-brand gradient for New deck",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage(),errors=await workspace(page)
    const gradient=await page.locator(".home-new-deck summary").evaluate(element=>getComputedStyle(element).backgroundImage)
    expect(gradient).toBe("linear-gradient(rgb(147, 184, 239), rgb(77, 148, 251))")
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

it("reveals starred card actions on hover, keyboard focus and an open menu",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923},reducedMotion:"reduce"}),errors=await workspace(page)
    const card=page.locator(".deck-card").first(),actions=card.locator(".deck-card-actions")
    expect(await actions.evaluate(element=>getComputedStyle(element).opacity)).toBe("0")
    await card.hover()
    await expect.poll(()=>actions.evaluate(element=>getComputedStyle(element).opacity)).toBe("1")
    await page.mouse.move(1400,900)
    await card.getByRole("button",{name:/Unstar/}).focus()
    await expect.poll(()=>actions.evaluate(element=>getComputedStyle(element).opacity)).toBe("1")
    await card.getByLabel(`Actions for ${decks[0].title}`,{exact:true}).click()
    await page.getByRole("heading",{name:"Recents",exact:true}).evaluate(element=>{element.setAttribute("tabindex","-1");element.focus()})
    await page.mouse.move(1400,900)
    expect(await card.locator("details").evaluate(element=>element instanceof HTMLDetailsElement&&element.open)).toBe(true)
    await expect.poll(()=>actions.evaluate(element=>getComputedStyle(element).opacity)).toBe("1")
    expect(await card.getByRole("button",{name:"Move to Trash",exact:true}).isVisible()).toBe(true)
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

it("keeps real previews and visible 44px card actions on touch",async()=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=await workspace(page)
    expect(await page.locator(".deck-card-actions").first().evaluate(element=>getComputedStyle(element).opacity)).toBe("1")
    const target=await page.locator(".deck-star").first().boundingBox()
    expect(target?.width).toBeGreaterThanOrEqual(44)
    expect(target?.height).toBeGreaterThanOrEqual(44)
    expect(await page.locator(".deck-preview-canvas").first().textContent()).toContain("A clear direction")
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

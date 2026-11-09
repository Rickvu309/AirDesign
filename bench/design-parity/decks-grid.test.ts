import path from "node:path"
import {readFile} from "node:fs/promises"
import sharp from "sharp"
import {build} from "vite"
import {chromium,type Page} from "playwright"
import {beforeAll,expect,it} from "vitest"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import type {DeckEntry} from "../../packages/catalog/src/index.ts"
import {assertScenarioDOM} from "./dom-assertions.ts"
import {readRegistry,type Scenario} from "./registry.ts"

let script="",styles=""
const deck=fixtureDeck(1),title="Independent customer research"
const slide=deck.slides[0]
if(!slide)throw new Error("missing-grid-fixture-slide")
const decks:DeckEntry[]=[false,true].map((portrait,index)=>({id:`research-${index}`,title:`${title} ${index}`,updated:1762484400000-index,created:1762484400000,deletedAt:null,generation:0,pendingRequest:"",slides:1,starred:true,preview:{slide:{...slide,size:portrait ? {width:540,height:960} : slide.size},themes:deck.themes}}))
const firstDeck=decks[0]
if(!firstDeck)throw new Error("missing-grid-fixture-deck")
const firstDeckTitle=firstDeck.title
beforeAll(async()=>{
  const entry=path.resolve("virtual:decks-grid-proof")
  const built=await build({configFile:false,logLevel:"silent",oxc:{jsx:{runtime:"automatic",development:false}},define:{"process.env.NODE_ENV":JSON.stringify("production")},resolve:{alias:{"@airdesign/ui":path.resolve("packages/ui/src/index.ts")}},plugins:[{name:"decks-grid-proof",resolveId:source=>source===entry ? entry : undefined,load:source=>source===entry ? `import {createElement} from "react";import {createRoot} from "react-dom/client";import {Workspace} from "${path.resolve("apps/studio/src/decks/workspace.tsx")}";import {StudioShell} from "${path.resolve("apps/studio/src/shell/studio-shell.tsx")}";import "${path.resolve("apps/studio/src/editor/workspace.css")}";import "${path.resolve("apps/studio/src/decks/decks.css")}";import "${path.resolve("packages/ui/src/tokens/tokens.css")}";createRoot(document.getElementById("root")).render(createElement(StudioShell,{intentLabel:"",showIntent:false,onSignOut:()=>{},search:"",onSearch:()=>{},starredDecks:[]},createElement(Workspace)));` : undefined}],build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"DecksGridProof"}}})
  const outputs=(Array.isArray(built) ? built : [built]).flatMap(output=>"output" in output ? output.output : [])
  script=outputs.filter(output=>output.type==="chunk").map(output=>output.code).join("\n")
  styles=outputs.flatMap(output=>output.type==="asset"&&output.fileName.endsWith(".css") ? [typeof output.source==="string" ? output.source : new TextDecoder().decode(output.source)] : []).join("\n")
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
  await page.getByRole("heading",{name:firstDeckTitle,exact:true}).waitFor()
  return errors
}

async function newDeckLabelContrast(page:Page){
  const button=page.getByRole("button",{name:"New deck",exact:true})
  if(await button.count()!==1||!await button.isVisible())throw new Error("new-deck-contrast-control-not-visible")
  await page.evaluate(()=>document.fonts.ready)
  const label=await button.evaluate(element=>{
    const style=getComputedStyle(element),box=element.getBoundingClientRect()
    const node=[...element.childNodes].find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim()==="New deck")
    if(!node)throw new Error("new-deck-contrast-label-missing")
    const range=document.createRange();range.selectNodeContents(node)
    const text=range.getBoundingClientRect()
    for(let ancestor:Element|null=element;ancestor;ancestor=ancestor.parentElement){
      const paint=getComputedStyle(ancestor)
      if(paint.opacity!=="1"||paint.filter!=="none"||paint.mixBlendMode!=="normal"||paint.visibility!=="visible")throw new Error("new-deck-contrast-unsupported-compositing")
    }
    if(style.textShadow!=="none"||!document.fonts.check(style.font)||box.width<=0||box.height<=0||text.width<=0||text.height<=0)throw new Error("new-deck-contrast-unmeasurable-label")
    return {text:node.textContent,color:style.color,font:style.font,background:style.backgroundImage,box:{x:box.x,y:box.y,width:box.width,height:box.height},range:{x:text.x,y:text.y,width:text.width,height:text.height}}
  })
  const color=label.color.match(/^rgb\((\d+), (\d+), (\d+)\)$/)
  if(!color||color[1]===undefined||color[2]===undefined||color[3]===undefined)throw new Error("new-deck-contrast-requires-opaque-rgb")
  const luminance=(red:number,green:number,blue:number)=>{
    const linear=(value:number)=>value/255<=0.04045 ? value/255/12.92 : ((value/255+0.055)/1.055)**2.4
    return linear(red)*0.2126+linear(green)*0.7152+linear(blue)*0.0722
  }
  const foreground=luminance(Number(color[1]),Number(color[2]),Number(color[3]))
  const clip={x:Math.floor(label.box.x),y:Math.floor(label.box.y),width:Math.ceil(label.box.x+label.box.width)-Math.floor(label.box.x),height:Math.ceil(label.box.y+label.box.height)-Math.floor(label.box.y)}
  const painted=await page.screenshot({clip}),hidden=await page.addStyleTag({content:".home-new-deck .ad-dropdown>summary{color:transparent!important}"})
  let background:Buffer
  try{background=await page.screenshot({clip})}finally{await hidden.evaluate(element=>{if(!(element instanceof HTMLStyleElement))throw new Error("new-deck-contrast-style-boundary");element.remove()})}
  const visible=await sharp(painted).removeAlpha().raw().toBuffer({resolveWithObject:true}),underlying=await sharp(background).removeAlpha().raw().toBuffer({resolveWithObject:true})
  if(visible.info.width!==underlying.info.width||visible.info.height!==underlying.info.height||visible.info.channels!==3||underlying.info.channels!==3)throw new Error("new-deck-contrast-raster-mismatch")
  let minimum=Infinity,samples=0
  for(let y=0;y<underlying.info.height;y++)for(let x=0;x<underlying.info.width;x++){
    const px=x+clip.x+0.5,py=y+clip.y+0.5
    if(px<label.range.x||px>label.range.x+label.range.width||py<label.range.y||py>label.range.y+label.range.height)continue
    const offset=(y*underlying.info.width+x)*3
    const red=underlying.data[offset],green=underlying.data[offset+1],blue=underlying.data[offset+2],inkRed=visible.data[offset],inkGreen=visible.data[offset+1],inkBlue=visible.data[offset+2]
    if(red===undefined||green===undefined||blue===undefined||inkRed===undefined||inkGreen===undefined||inkBlue===undefined)throw new Error("new-deck-contrast-raster-pixel-missing")
    if(Math.max(Math.abs(inkRed-red),Math.abs(inkGreen-green),Math.abs(inkBlue-blue))<=8)continue
    const paint=luminance(red,green,blue)
    minimum=Math.min(minimum,(Math.max(foreground,paint)+0.05)/(Math.min(foreground,paint)+0.05));samples++
  }
  if(!samples||!Number.isFinite(minimum))throw new Error("new-deck-contrast-visible-label-ink-missing")
  return {minimum,samples,label}
}

async function newDeckMenuRoundTrip(page:Page){
  const button=page.getByRole("button",{name:"New deck",exact:true})
  await button.click()
  expect(await page.getByRole("button",{name:"Blank deck",exact:true}).isVisible()).toBe(true)
  await button.click()
  expect(await button.evaluate(element=>element.parentElement instanceof HTMLDetailsElement&&!element.parentElement.open)).toBe(true)
}

it.each(["recent","all"])("requires %s New deck nominal opaque-label footprint contrast >=4.5, independently of gradient averages",async browse=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923},deviceScaleFactor:1,reducedMotion:"reduce"}),errors=await workspace(page,browse)
    await newDeckMenuRoundTrip(page)
    const measured=await newDeckLabelContrast(page)
    expect(measured.label.color).toBe("rgb(34, 34, 34)")
    expect(errors).toEqual([])
    expect(measured.minimum,JSON.stringify(measured)).toBeGreaterThanOrEqual(4.5)
  }finally{await browser.close()}
})

it.each(["recent","all"].flatMap(browse=>[
  {browse,paint:"current",override:""},
  {browse,paint:"arbitrary",override:".home-new-deck .ad-dropdown>summary{background:#ffee00}"}
]))("rejects $browse $paint paint despite dead signature membership after a passing connected-control baseline",async({browse,override})=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923},deviceScaleFactor:1,reducedMotion:"reduce"}),errors=await workspace(page,browse)
    const baselineStyle=await page.addStyleTag({content:".home-new-deck .ad-dropdown>summary{background:var(--signature-gradient);color:var(--primary-foreground)}"})
    await newDeckMenuRoundTrip(page)
    const baseline=await newDeckLabelContrast(page)
    expect(baseline.minimum,JSON.stringify(baseline)).toBeGreaterThanOrEqual(4.5)
    const control=await page.getByRole("button",{name:"New deck",exact:true}).elementHandle()
    if(!control)throw new Error("new-deck-contrast-baseline-control-missing")
    await baselineStyle.evaluate(element=>{if(!(element instanceof HTMLStyleElement))throw new Error("new-deck-contrast-baseline-style-boundary");element.remove()})
    const mutation=".never-mounted-primary{background:var(--signature-gradient)}.home-new-deck .ad-dropdown>summary{color:var(--primary-foreground)}"+override
    await page.addStyleTag({content:mutation})
    expect(await readFile("apps/studio/src/decks/decks.css","utf8")+mutation).toMatch(/background:\s*var\(--signature-gradient\)/)
    expect(await page.locator(".never-mounted-primary").count()).toBe(0)
    expect(await control.evaluate(element=>element.isConnected&&element===document.querySelector(".home-new-deck .ad-dropdown>summary"))).toBe(true)
    await newDeckMenuRoundTrip(page)
    const mutated=await newDeckLabelContrast(page)
    expect(mutated.label.box).toEqual(baseline.label.box)
    expect(mutated.label.range).toEqual(baseline.label.range)
    expect(mutated.label.font).toBe(baseline.label.font)
    expect(mutated.label.color).toBe(baseline.label.color)
    expect(mutated.label.text).toBe(baseline.label.text)
    expect(()=>expect(mutated.minimum,JSON.stringify(mutated)).toBeGreaterThanOrEqual(4.5)).toThrow(/to be greater than or equal to 4\.5/)
    console.info("NEW_DECK_CONTRAST_MUTATION",JSON.stringify({browse,paint:override ? "arbitrary" : "current",baseline,mutated}))
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

it.each(["recent","all"])("frames %s cards with the designed spacing and real landscape/portrait previews",async browse=>{
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}}),errors=await workspace(page,browse)
    const measurements=await page.locator(".deck-card").evaluateAll(cards=>cards.map(card=>{
      const cover=card.querySelector(".deck-cover"),canvas=card.querySelector(".deck-preview-canvas")
      if(!cover||!canvas)throw new Error("missing-grid-card-preview")
      const box=card.getBoundingClientRect(),preview=cover.getBoundingClientRect(),slide=canvas.getBoundingClientRect()
      return {offset:preview.y-box.y,height:preview.height,contained:slide.width<=preview.width+0.1&&slide.height<=preview.height+0.1,ratio:slide.width/slide.height,text:canvas.textContent}
    }))
    expect(measurements.map(value=>value.offset)).toEqual([65,65])
    expect(measurements.map(value=>value.height)).toEqual([browse==="recent" ? 200 : 180,browse==="recent" ? 200 : 180])
    expect(measurements.map(value=>value.contained)).toEqual([true,true])
    const [landscape,portrait]=measurements
    if(!landscape||!portrait)throw new Error("missing-grid-preview-measurements")
    expect(landscape.ratio).toBeCloseTo(960/540)
    expect(portrait.ratio).toBeCloseTo(540/960)
    expect(measurements.every(value=>value.text?.includes("A clear direction"))).toBe(true)
    expect(await page.locator(".deck-grid").evaluate(element=>getComputedStyle(element).gap)).toBe("20px")
    expect(await page.getByRole("link",{name:`Open ${firstDeckTitle}`,exact:true}).getAttribute("href")).toBe("/deck/research-0")
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
    await card.getByLabel(`Actions for ${firstDeckTitle}`,{exact:true}).click()
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
    const action=page.locator(".deck-star").first()
    const geometry=()=>action.evaluate(element=>{
      const rect=element.getBoundingClientRect()
      return {width:rect.width,height:rect.height,owned:[[rect.left+.5,rect.top+rect.height/2],[rect.right-.5,rect.top+rect.height/2]].every(([x,y])=>x!==undefined&&y!==undefined&&element.contains(document.elementFromPoint(x,y)))}
    })
    const assertTarget=async()=>{const target=await geometry();expect(target.width).toBeGreaterThanOrEqual(44);expect(target.height).toBeGreaterThanOrEqual(44);expect(target.owned).toBe(true)}
    await assertTarget()
    const original=await action.getAttribute("style")
    try{
      await action.evaluate(element=>{element.style.setProperty("min-inline-size","43px","important");element.style.setProperty("inline-size","43px","important")})
      expect((await geometry()).width).toBe(43)
      await expect(assertTarget()).rejects.toThrow()
    }finally{await action.evaluate((element,style)=>{if(style===null)element.removeAttribute("style");else element.setAttribute("style",style)},original)}
    await assertTarget()
    expect(await page.locator(".deck-preview-canvas").first().textContent()).toContain("A clear direction")
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

it.each(["S31.02","S31.04"])("classifies %s grid metadata as body text and rejects independent token mutations",async code=>{
  const entry=(await readRegistry()).find(entry=>entry.code===code)
  if(!entry)throw new Error("missing-grid-metadata-scenario")
  const metadata=entry.assertions.structure.textRoles.find(role=>"selector" in role&&role.selector===".deck-card-details > p")
  if(!metadata||!("selector" in metadata))throw new Error("missing-grid-metadata-role")
  const focused={...entry,assertions:{...entry.assertions,structure:{...entry.assertions.structure,icons:[],textRoles:[metadata]}}}
  const old={...focused,assertions:{...focused.assertions,structure:{...focused.assertions.structure,textRoles:[{...metadata,role:"helper"}]}}} satisfies Scenario
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage({viewport:entry.viewport}),errors=await workspace(page,code==="S31.04" ? "all" : "recent")
    await expect(assertScenarioDOM(page,old)).rejects.toThrow("text-token:helper")
    await expect(assertScenarioDOM(page,focused)).resolves.toBeUndefined()
    expect(metadata.role).toBe("body")
    const paragraph=page.locator(metadata.selector).first()
    expect(await paragraph.evaluate(element=>({size:getComputedStyle(element).fontSize,weight:getComputedStyle(element).fontWeight,color:getComputedStyle(element).color}))).toEqual({size:"13px",weight:"400",color:"rgb(102, 102, 102)"})
    const originalStyle=await paragraph.getAttribute("style")
    for(const mutation of [
      {style:"font-size:12px",check:"text-token:body"},
      {style:"font-size:15px",check:"text-token:body"},
      {style:"font-family:Arial",check:"text-token:body"},
      {style:"font-weight:500",check:"text-token:body"},
      {style:"color:#909090",check:"text-color:body"},
      {style:"background-color:#d0d0d0",check:"text-contrast:body"}
    ]){
      await expect(assertScenarioDOM(page,focused)).resolves.toBeUndefined()
      await paragraph.evaluate((element,style)=>element.setAttribute("style",style),mutation.style)
      await expect(assertScenarioDOM(page,focused),mutation.style).rejects.toThrow(mutation.check)
      await paragraph.evaluate((element,style)=>{if(style===null)element.removeAttribute("style");else element.setAttribute("style",style)},originalStyle)
    }
    await expect(assertScenarioDOM(page,focused)).resolves.toBeUndefined()
    expect(errors).toEqual([])
  }finally{await browser.close()}
})

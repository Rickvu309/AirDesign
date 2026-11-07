import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/shell-controls"))
await mkdir(out,{recursive:true})
const local=await stack(),browser=await chromium.launch({headless:true}),results={}
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S41.01"),setup=await seed(local,entry)
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();await page.goto(local.origin+setup.route)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  results.grid=await page.locator(".editor-section h2").first().evaluate(element=>{const style=getComputedStyle(element);return {size:style.fontSize,height:element.getBoundingClientRect().height,bottom:style.marginBottom,gap:style.gap}})
  await page.screenshot({path:path.join(out,"grid.png"),animations:"disabled"})
  assert.deepEqual(results.grid,{size:"12px",height:20,bottom:"16px",gap:"12px"})
  await page.getByRole("button",{name:"Single slide view",exact:true}).click()
  results.notes=await page.locator(".editor-notes-panel").evaluate(element=>{const box=element.getBoundingClientRect(),grip=element.querySelector(".editor-notes-grip").getBoundingClientRect();return {height:box.height,gripWidth:grip.width,gripHeight:grip.height,gap:box.top-grip.bottom}})
  assert.deepEqual(results.notes,{height:48,gripWidth:48,gripHeight:4,gap:8})
  results.filmstrip=await page.locator(".editor-filmstrip details[open] .slide-preview").first().evaluate(element=>({width:element.getBoundingClientRect().width,shadow:getComputedStyle(element).boxShadow}))
  assert.equal(results.filmstrip.width,180);assert.ok(results.filmstrip.shadow.includes("1px"))
  const dock=page.getByRole("navigation",{name:"Design tools",exact:true}),panelSwitch=dock.locator(".editor-panel-switch")
  assert.equal(await panelSwitch.locator("button>svg").count(),2)
  assert.equal(await panelSwitch.evaluate(element=>element.getBoundingClientRect().height),32)
  results.dock=await dock.evaluate(element=>({gap:getComputedStyle(element).gap,divider:getComputedStyle(element.querySelector(".dock-divider")).marginInlineStart}))
  assert.deepEqual(results.dock,{gap:"4px",divider:"4px"})
  const zoom=page.locator("[data-zoom-value]")
  results.zoom=await page.locator(".editor-slide:not([hidden]) .slide-preview").evaluate(element=>Math.round(element.getBoundingClientRect().width/1280*100))
  assert.equal(await zoom.textContent(),`${results.zoom}%`)
  await page.screenshot({path:path.join(out,"single.png"),animations:"disabled"})
  const selectedSlide=await page.locator(".editor-filmstrip button[aria-current=page]").getAttribute("aria-label")
  const notes=page.getByRole("textbox",{name:"Speaker notes",exact:true}),before=Number(await page.locator(".studio-editor").getAttribute("data-seq"))
  await notes.fill("Keep the executive message concise.")
  await page.waitForFunction(seq=>Number(document.querySelector(".studio-editor").dataset.seq)>seq,before)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  await page.reload();await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  await page.getByRole("button",{name:"Single slide view",exact:true}).click()
  await page.getByRole("button",{name:selectedSlide,exact:true}).click()
  assert.equal(await page.getByRole("textbox",{name:"Speaker notes",exact:true}).inputValue(),"Keep the executive message concise.")
  results.persistedNotes=true
  await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2))
}finally{await browser.close();await local.close()}

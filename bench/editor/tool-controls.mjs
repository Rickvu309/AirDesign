import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/editor-capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/panel-controls"))
await mkdir(out,{recursive:true})
const local=await stack(),browser=await chromium.launch({headless:true}),results={}
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S43.04"),setup=await seed(local,entry)
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();await page.goto(local.origin+setup.route)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  const tray=page.getByRole("complementary",{name:"Shapes browser",exact:true})
  results.quick=await tray.locator(".shape-choices:not(.shape-lines)>button").evaluateAll(elements=>elements.map(element=>({name:element.getAttribute("aria-label"),width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height})))
  assert.equal(results.quick.length,9);assert.ok(results.quick.every(item=>item.width===36&&item.height===36));assert.equal(results.quick[4].name,"Star");assert.equal(results.quick[8].name,"Callout")
  await page.screenshot({path:path.join(out,"quick.png"),animations:"disabled"})
  await tray.getByRole("button",{name:"More shapes",exact:true}).click();await tray.getByRole("button",{name:"Back from Shapes",exact:true}).click();assert.equal(await tray.getAttribute("data-expanded"),"false")
  await page.getByRole("button",{name:"Edit slide text",exact:true}).click()
  results.text=await page.locator(".text-style").evaluateAll(elements=>elements.map(element=>({name:element.textContent,size:getComputedStyle(element).fontSize,tracking:getComputedStyle(element).letterSpacing,lineHeight:getComputedStyle(element).lineHeight})))
  assert.deepEqual(results.text.map(item=>item.size),["30px","22px","18px","15px","15px","14px","13px","12px"])
  assert.equal(results.text[0].lineHeight,"33px")
  await page.screenshot({path:path.join(out,"text.png"),animations:"disabled"})
  await page.getByRole("button",{name:"Back from Text",exact:true}).click();await page.getByRole("button",{name:"Actions",exact:true}).click()
  const actions=page.getByRole("complementary",{name:"Actions picker",exact:true})
  results.actions=await actions.evaluate(element=>({width:element.getBoundingClientRect().width,searchHeight:element.querySelector(".tool-search").getBoundingClientRect().height,icons:element.querySelectorAll(".editor-action>svg").length,returnGlyph:element.textContent.includes("↵")}))
  assert.equal(results.actions.width,320);assert.equal(results.actions.searchHeight,36);assert.equal(results.actions.icons,5);assert.equal(results.actions.returnGlyph,false)
  await actions.getByRole("textbox",{name:"Search actions",exact:true}).fill("Chart");assert.equal(await actions.getByRole("button",{name:"Table",exact:true}).count(),0)
  await actions.getByRole("textbox",{name:"Search actions",exact:true}).fill("");await page.screenshot({path:path.join(out,"actions.png"),animations:"disabled"})
  const before=Number(await page.locator(".studio-editor").getAttribute("data-seq"))
  await actions.getByRole("button",{name:"Chart",exact:true}).click()
  await page.waitForFunction(before=>Number(document.querySelector(".studio-editor")?.getAttribute("data-seq"))>before,before)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  assert.equal(await actions.count(),0)
  const snapshot=await page.request.get(local.origin+setup.route.replace("/deck/","/api/decks/")).then(response=>response.json())
  assert.ok(snapshot.deck.slides.some(slide=>slide.elements.some(element=>element.kind==="group"&&element.children.length===3&&element.children.every(child=>child.kind==="shape"))))
  results.insertion="Chart persisted as three native bars; actions closed"
  await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2));await context.close()
}finally{await browser.close();await local.close()}

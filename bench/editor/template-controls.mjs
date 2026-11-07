import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/template-controls"))
await mkdir(out,{recursive:true})
const local=await stack(),browser=await chromium.launch({headless:true}),results={}
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S43.01"),setup=await seed(local,entry)
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();await page.goto(local.origin+setup.route)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  const picker=page.getByLabel("Template picker",{exact:true}),search=page.getByRole("textbox",{name:"Search templates",exact:true}),trigger=page.getByRole("button",{name:"Choose template",exact:true})
  assert.equal(await search.evaluate(element=>element===document.activeElement),true)
  results.geometry=await picker.evaluate(element=>{const style=getComputedStyle(element),search=element.querySelector(".template-search");return {width:element.getBoundingClientRect().width,radius:style.borderRadius,bottom:style.paddingBottom,searchHeight:search.getBoundingClientRect().height,searchBackground:getComputedStyle(search).backgroundColor}})
  assert.equal(results.geometry.width,496);assert.equal(results.geometry.radius,"14px");assert.equal(results.geometry.bottom,"20px");assert.equal(results.geometry.searchHeight,40);assert.notEqual(results.geometry.searchBackground,"rgba(0, 0, 0, 0)")
  assert.equal(await picker.locator("header").count(),0)
  assert.equal((await picker.locator(".template-card").allTextContents()).some(text=>text.includes(" · v")),false)
  await search.fill("Dark");assert.equal(await picker.locator(".template-card").count(),1)
  await page.keyboard.press("Escape");assert.equal(await picker.count(),0);assert.equal(await trigger.evaluate(element=>element===document.activeElement),true)
  await trigger.click();await page.locator(".editor-notes").click();assert.equal(await picker.count(),0)
  await trigger.click();await search.fill("Dark");await picker.getByRole("button",{name:"Dark slides",exact:true}).click();assert.equal(await picker.count(),0);assert.equal(await trigger.evaluate(element=>element===document.activeElement),true)
  await trigger.click();await search.fill("");await page.screenshot({path:path.join(out,"picker.png"),animations:"disabled"})
  results.behavior="filters names; Escape, outside pointer and selection dismiss; focus returns to trigger"
  await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2));await context.close()
}finally{await browser.close();await local.close()}

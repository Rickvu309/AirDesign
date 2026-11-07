import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/panel-controls"))
await mkdir(out,{recursive:true})
const local=await stack(),browser=await chromium.launch({headless:true}),results={}
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S42.02"),setup=await seed(local,entry)
  const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();await page.goto(local.origin+setup.route)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  assert.equal(await page.locator('.aira-composer button[aria-label="Remove Slide 3"]').count(),1)
  assert.equal(await page.locator('details.aira-activity-log').count(),0)
  const expected=await page.request.get(local.origin+"/api/usage").then(response=>response.json())
  await page.getByRole("button",{name:"Usage",exact:true}).click()
  await page.getByLabel("Usage details").getByText(`${Math.round(expected.used/100)}% used`,{exact:true}).waitFor()
  assert.equal(await page.getByLabel("Weekly usage",{exact:true}).getAttribute("value"),String(expected.used))
  await page.getByLabel("Move and Hand tools",{exact:true}).click()
  await page.getByRole("group",{name:"Canvas navigation"}).waitFor()
  await page.screenshot({path:path.join(out,"usage-move-desktop.png"),animations:"disabled"})
  await page.getByRole("button",{name:"Hand tool",exact:true}).click()
  assert.equal(await page.locator('.studio-editor').getAttribute("data-navigation"),"hand")
  const sequence=await page.locator('.studio-editor').getAttribute("data-seq"),canvas=await page.locator(".editor-slide:not([hidden])>.slide-preview").boundingBox()
  await page.mouse.move(canvas.x+180,canvas.y+120);await page.mouse.down();await page.mouse.move(canvas.x+220,canvas.y+160);await page.mouse.up()
  assert.equal(await page.locator('.studio-editor').getAttribute("data-seq"),sequence)
  assert.equal(await page.locator('.element-selection').count(),0)
  await page.keyboard.press("v")
  assert.equal(await page.locator('.studio-editor').getAttribute("data-navigation"),"move")
  await page.getByLabel("Move and Hand tools",{exact:true}).click();await page.keyboard.press("Escape")
  assert.equal(await page.locator('.editor-navigation-menu[open]').count(),0)
  results.usage={used:expected.used,credits:expected.paid+expected.bonus}
  results.navigation="hand drag preserves document; V restores move; Escape dismisses menu"
  await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2))
  await context.close()
}finally{await browser.close();await local.close()}

import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/zoom-scale"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),local=await stack(),results=[]
let context
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S42.02"),setup=await seed(local,entry)
  context=await browser.newContext({viewport:entry.viewport,reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();page.setDefaultTimeout(5000)
  await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  async function measure(name,width){
    assert.equal(await page.locator("[data-zoom-value]").count(),1,"Visible percentage hook missing")
    await page.waitForFunction(()=>{const value=document.querySelector('[data-zoom-value]'),frame=document.querySelector('.editor-slide[data-selected=true]:not([hidden]) .slide-preview'),native=frame?.querySelector('.slide-canvas');return value&&frame&&native&&value.textContent===Math.round(frame.getBoundingClientRect().width/(parseFloat(native.style.inlineSize)*96/72)*100)+'%'})
    const value=await page.locator("[data-zoom-value]").evaluate(node=>{const box=node.getBoundingClientRect(),frame=document.querySelector('.editor-slide[data-selected=true]:not([hidden]) .slide-preview');return {text:node.textContent,width:frame.getBoundingClientRect().width,visible:node.checkVisibility(),lines:node.getClientRects().length,x:box.x,y:box.y,children:node.children.length}})
    results.push({name,...value});await writeFile(path.join(out,"results.json"),JSON.stringify(results,null,2))
    assert.match(value.text,/^\d{1,3}%$/);assert(value.visible);assert.equal(value.lines,1);assert.equal(value.children,0)
    assert(Math.abs(value.width-width)<1,`${name}: expected ${width}px, measured ${value.width}`)
    assert(value.x>1100&&value.y<40,`${name}: percentage moved from toolbar`)
    await page.screenshot({path:path.join(out,name+".png"),animations:"disabled"})
  }
  await measure("single",800)
  await page.getByRole("button",{name:"Edit slide text",exact:true}).click();await measure("tool",720)
  await page.getByRole("button",{name:"Select slides",exact:true}).click()
  await page.getByRole("button",{name:"Grid view",exact:true}).click();await measure("grid",300)
  await page.getByRole("combobox",{name:"Zoom",exact:true}).selectOption("50");await measure("grid-50",640)
  process.stdout.write(JSON.stringify({passed:true,results})+"\n")
}finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close();await browser.close()}

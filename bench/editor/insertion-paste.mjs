import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/editor-capture.mjs"
import {assertControlPaint} from "../design-parity/dom-assertions.ts"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/image-library"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),local=await stack()
let context
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S41.03"),setup=await seed(local,entry)
  context=await browser.newContext({viewport:entry.viewport,reducedMotion:"reduce",permissions:["clipboard-read","clipboard-write"]})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();page.setDefaultTimeout(5000)
  await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  await page.getByRole('button',{name:'Slide 5',exact:true}).click()
  const add=page.getByRole('button',{name:'New slide',exact:true});await add.hover()
  const marker=await page.locator('.editor-slide[data-selected=true]').evaluate(node=>{const style=getComputedStyle(node,'::after');return {width:style.width,height:style.height,content:style.content}})
  assert.equal(marker.width,'2px');assert.equal(marker.height,'36px')
  await perform(page,{kind:'hold',name:'New slide'},local,setup.owner)
  const ghost=page.locator('.contextual-insertion'),bounds=await ghost.boundingBox(),five=await page.getByRole('button',{name:'Slide 5',exact:true}).locator('..').boundingBox()
  assert(bounds.x>five.x);assert.equal(bounds.width,300);assert(Math.abs(bounds.height-169)<1)
  const style=await page.locator('.contextual-insertion-slot').evaluate(node=>{const s=getComputedStyle(node);return {color:s.borderColor,fill:s.backgroundColor,border:s.borderWidth,radius:s.borderRadius}})
  assert.equal(style.color,'rgb(168, 168, 168)');assert.equal(style.fill,'rgb(234, 234, 231)');assert.equal(style.border,'2px');assert.equal(style.radius,'2px')
  await page.screenshot({path:path.join(out,'held.png'),animations:'disabled'})
  await page.getByRole('button',{name:'Add slide here',exact:true}).click();await page.getByRole('button',{name:'Title',exact:true}).click()
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor();assert.equal((await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck.slides.length,9)
  const historyUndo=page.locator('.editor-history').getByRole('button',{name:'Undo',exact:true})
  await assertControlPaint(historyUndo,"icon")
  const handle=await historyUndo.elementHandle()
  await handle.evaluate(element=>{const closed=document.createElement('details');closed.id='history-closed-menu-negative';element.parentElement.after(closed);closed.append(element)})
  await assert.rejects(assertControlPaint(page.locator('#history-closed-menu-negative button'),"icon"))
  await handle.evaluate(element=>{document.querySelector('.editor-history').prepend(element);document.querySelector('#history-closed-menu-negative').remove()})
  await assertControlPaint(historyUndo,"icon")
  await historyUndo.click();await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  assert.equal((await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck.slides.length,8)
  await add.press('ArrowDown');await ghost.waitFor();await page.keyboard.press('Escape');await ghost.waitFor({state:'hidden'})
  await page.getByRole('button',{name:'Slide 2',exact:true}).click();const beforePaste=Number(await page.locator('.studio-editor').getAttribute('data-seq'));await perform(page,{kind:'paste-slides',count:2},local,setup.owner)
  await page.getByText('2 slides pasted from PowerPoint',{exact:true}).waitFor()
  const toast=await page.locator('.ad-powerpoint-paste').evaluate(node=>{const s=getComputedStyle(node),b=getComputedStyle(node.querySelector('[data-button]'));return {width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height,padding:s.padding,action:b.backgroundColor}})
  assert.equal(toast.height,40);assert.equal(toast.padding,'0px 6px 0px 14px');assert.equal(toast.action,'rgba(0, 0, 0, 0)');assert(toast.width<340)
  await page.waitForFunction(seq=>{const e=document.querySelector('.studio-editor');return Number(e.dataset.seq)>seq&&e.dataset.syncState==='saved'},beforePaste)
  const pasted=(await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck
  assert.equal(pasted.slides.length,10);assert.equal(pasted.slides[2].section,pasted.slides[1].section)
  assert.deepEqual(pasted.slides.slice(2,4).map(slide=>slide.notes),["Canonical render fixture","Canonical render fixture"])
  assert.deepEqual(pasted.slides.slice(2,4).map(slide=>slide.elements[0].runs),["Market share by region","Churn is down to 4%"].map(text=>[{text,font:"Geist",size:48,bold:true,color:"#1F1F1F"}]))
  const contents=pasted.slides.slice(2,4).map(slide=>({notes:slide.notes,elements:slide.elements}))
  await page.reload();await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  const reloaded=(await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck
  assert.deepEqual(reloaded.slides.slice(2,4).map(slide=>({notes:slide.notes,elements:slide.elements})),contents)
  await page.screenshot({path:path.join(out,'pasted.png'),animations:'disabled'})
  await page.locator('.editor-history').getByRole('button',{name:'Undo',exact:true}).click()
  await page.waitForFunction(()=>document.querySelectorAll('.editor-slides .editor-slide').length===8)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  assert.equal((await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck.slides.length,8)
  await page.locator('.editor-history').getByRole('button',{name:'Redo',exact:true}).click()
  await page.waitForFunction(()=>document.querySelectorAll('.editor-slides .editor-slide').length===10)
  await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  assert.deepEqual((await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck.slides.slice(2,4).map(slide=>({notes:slide.notes,elements:slide.elements})),contents)
  await writeFile(path.join(out,'results.json'),JSON.stringify({hold:true,closedMenuUndoRejected:true,layoutUndo:true,pasteNative:true,preservedNotes:true,preservedRuns:true,reload:true,undo:true,redo:true,contents},null,2))
  process.stdout.write('PASS insertion marker, held anchor, layout insertion, atomic Undo, authentic PowerPoint paste after Slide 2\n')
}finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close();await browser.close()}

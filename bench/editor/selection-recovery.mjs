import assert from "node:assert/strict"
import {mkdir} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/selection-recovery"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),registry=await readRegistry(),failures=[]
async function scenario(code,check){
  const local=await stack(),entry=registry.find(entry=>entry.code===code),setup=await seed(local,entry)
  let context
  try{
    context=await browser.newContext({viewport:entry.viewport,reducedMotion:"reduce"})
    await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
    const page=await context.newPage();page.setDefaultTimeout(8000)
    await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
    await check(page,local,setup,entry)
  }catch(error){failures.push({code,error:String(error)});process.stderr.write(code+" FAIL "+String(error)+"\n")}finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close()}
}
const seq=page=>page.locator('.studio-editor').getAttribute('data-seq').then(Number)
const savedAfter=(page,before)=>page.waitForFunction(before=>{const e=document.querySelector('.studio-editor');return Number(e.dataset.seq)>before&&e.dataset.syncState==='saved'},before)
try{
  await scenario('S41.01',async(page,local,setup)=>{
    await page.getByRole('button',{name:'Slide 3',exact:true}).click();await page.getByRole('button',{name:'Single slide view',exact:true}).click()
    const chart=page.locator('.editor-slide:not([hidden]) [data-kind="group"]').first();await chart.click({position:{x:4,y:4}})
    const frame=page.locator('.element-selection'),handles=frame.locator('.element-resize')
    assert.equal(await handles.count(),4)
    assert.equal(await frame.evaluate(node=>getComputedStyle(node).borderWidth),'1px')
    const id=await chart.getAttribute('data-element'),read=async()=>{const deck=(await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1))).deck;return deck.slides[2].elements.find(element=>element.id===id).box}
    const initial=await read(),scale=(await chart.boundingBox()).width/initial.width
    for(const corner of ['nw','ne','sw','se']){
      const handle=frame.locator('[data-corner="'+corner+'"]'),visual=await handle.evaluate(node=>{const s=getComputedStyle(node,'::after');return {width:s.width,height:s.height,border:s.borderWidth}})
      assert.deepEqual(visual,{width:'7px',height:'7px',border:'1px'})
      const b=await handle.boundingBox();assert(b.width>=24&&b.height>=24)
      const before=await seq(page);await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+16,b.y+b.height/2+8);await page.mouse.up();await savedAfter(page,before)
      const changed=await read(),west=corner.endsWith('w'),north=corner.startsWith('n')
      for(const [key,value] of Object.entries({x:initial.x+(west ? 16/scale : 0),y:initial.y+(north ? 8/scale : 0),width:initial.width+(west ? -16/scale : 16/scale),height:initial.height+(north ? -8/scale : 8/scale)}))assert(Math.abs(changed[key]-value)<.1,corner+' '+key)
      const undo=await seq(page);await page.keyboard.press('Control+Z');await savedAfter(page,undo);assert.deepEqual(await read(),initial)
    }
    const before=await seq(page);await page.locator('.studio-editor').focus();await page.keyboard.press('Shift+ArrowRight');await savedAfter(page,before);assert.equal((await read()).x,initial.x+10)
    await page.screenshot({path:path.join(out,'selected.png'),animations:'disabled'})
  })
  await scenario('S49.01',async(page,local,setup,entry)=>{
    for(const step of entry.steps)await perform(page,step,local,setup.owner)
    const activity=page.locator('.aira-activity-log'),card=page.locator('.aira-failure-card'),resume=page.getByRole('button',{name:'Resume',exact:true})
    assert.equal(await activity.getAttribute('open'),null)
    assert.equal(await activity.locator('summary').textContent(),'Read 1 file, built slides 1 to 3')
    assert.match(await resume.evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/)
    assert.deepEqual(await card.evaluate(node=>{const s=getComputedStyle(node),status=getComputedStyle(node.querySelector('.aira-run-status')),icon=getComputedStyle(node.querySelector('strong>span'));return {padding:s.padding,gap:status.gap,font:status.fontSize,iconWidth:icon.width,iconRadius:icon.borderRadius}}),{padding:'14px',gap:'12px',font:'12.5px',iconWidth:'20px',iconRadius:'6px'})
    const box=await card.boundingBox();assert(box.y>=245&&box.y<=275);assert(box.height<140)
    await page.screenshot({path:path.join(out,'failed.png'),animations:'disabled'})
    await resume.click();await page.locator('.aira-run-status[data-kind="complete"]').waitFor({timeout:30000})
    const current=await local.request(setup.owner,'/api/decks/'+setup.route.split('/').at(-1));assert.equal(current.deck.slides.length,8)
  })
  await scenario('S49.02',async(page,local,setup,entry)=>{
    for(const step of entry.steps.filter(step=>step.kind!=='offline'))await perform(page,step,local,setup.owner)
    const canvas=page.locator('.editor-slide:not([hidden]) .slide-preview'),before=await canvas.boundingBox()
    await perform(page,{kind:'offline'},local,setup.owner)
    const status=page.locator('.editor-status:not([data-font-state])');assert.equal(await status.textContent(),"You're offline. Edits are saved on this device.")
    assert.equal(await status.getByRole('button').count(),0)
    const toast=await status.boundingBox();assert.equal(toast.height,40);assert(toast.width<340);assert.deepEqual(await status.evaluate(node=>{const s=getComputedStyle(node);return {left:s.paddingLeft,right:s.paddingRight,font:s.fontSize}}),{left:'14px',right:'16px',font:'13px'})
    assert.deepEqual(await canvas.boundingBox(),before)
    await page.screenshot({path:path.join(out,'offline.png'),animations:'disabled'})
    await page.locator('.deck-name').click();await page.getByRole('button',{name:'Reconnect',exact:true}).waitFor()
    await page.context().setOffline(false);await page.getByRole('button',{name:'Reconnect',exact:true}).click();await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
    assert.deepEqual(await canvas.boundingBox(),before)
  })
  assert.deepEqual(failures,[])
  process.stdout.write('PASS four-corner selection and resize/Undo, keyboard movement, failure/Resume, compact offline/reconnect and fixed canvas geometry\n')
}finally{await browser.close()}

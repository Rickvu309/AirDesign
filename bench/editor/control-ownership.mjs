import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"
import {assertScenarioControls,assertScenarioOwnedCopy} from "../design-parity/dom-assertions.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]),registry=await readRegistry(),browser=await chromium.launch(),results=[]
await mkdir(out,{recursive:true})
try{
 for(const code of ['S42.01','S42.02','S43.03','S49.02','S61.01']){
  const entry=registry.find(entry=>entry.code===code),local=await stack()
  let context
  try{
   const setup=await seed(local,entry)
   context=await browser.newContext({viewport:entry.viewport,reducedMotion:'reduce'})
   await context.addCookies(setup.owner.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
   const page=await context.newPage();page.setDefaultTimeout(5000)
   await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
   if(entry.assertions.entryControls){await assertScenarioControls(page,{...entry,component:undefined,assertions:{...entry.assertions,controls:entry.assertions.entryControls}})}
   for(const step of entry.steps)await perform(page,step,local,setup.owner)
   await assertScenarioControls(page,entry);await assertScenarioOwnedCopy(page,entry)
   const mutation=code==='S42.01' ? page.locator('.aira-panel').getByRole('button',{name:'Stop',exact:true}) : code==='S42.02' ? page.locator('.aira-panel').getByRole('button',{name:'Undo',exact:true}) : code==='S43.03' ? page.getByRole('button',{name:'Close images',exact:true}) : code==='S49.02' ? page.locator(entry.component.selector) : page.getByRole('button',{name:'Close export',exact:true})
   const target=await mutation.elementHandle(),style=await mutation.getAttribute('style')
   await target.evaluate(element=>element.style.setProperty('visibility','hidden','important'))
   await assert.rejects(async()=>{await assertScenarioControls(page,entry);await assertScenarioOwnedCopy(page,entry)})
   await target.evaluate((element,style)=>{if(style===null)element.removeAttribute('style');else element.setAttribute('style',style)},style)
   await assertScenarioControls(page,entry);await assertScenarioOwnedCopy(page,entry)
   await page.screenshot({path:path.join(out,code+'.png'),animations:'disabled'})
   if(code==='S42.01'){
    const before=await local.request(setup.owner,'/api/aira?deck='+setup.route.split('/').at(-1))
    await mutation.click();await page.locator('.aira-run-status[data-kind="stopped"]').waitFor()
    const stopped=await local.request(setup.owner,'/api/aira?deck='+setup.route.split('/').at(-1));assert.equal(stopped.run.id,before.run.id);assert.equal(stopped.run.kind,'stopped')
   }
   if(code==='S42.02'){
    await mutation.click();await page.getByText('Run undone. Your later edits are kept.',{exact:true}).waitFor()
    assert.equal((await local.request(setup.owner,'/api/aira?deck='+setup.route.split('/').at(-1))).run.kind,'undone')
   }
   if(code==='S43.03'){await mutation.click();await page.locator('.image-panel').waitFor({state:'hidden'})}
   if(code==='S49.02'){await context.setOffline(false);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()}
   results.push({code,controls:true,copy:true,hiddenNegative:true,realAction:true})
  }finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close()}
 }
 await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS actual owned controls, hidden negatives, Stop, selective Undo, Images close, offline reconnect and Export entry')
}finally{await browser.close()}

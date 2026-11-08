import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/editor-capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/working-sweep"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),local=await stack(),results=[]
let context
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S42.01"),setup=await seed(local,entry)
  context=await browser.newContext({viewport:entry.viewport,reducedMotion:"no-preference"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();page.setDefaultTimeout(5000)
  await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  const sweep=page.locator('.editor-slide:not([hidden]) [data-working-chart]')
  await sweep.waitFor()
  const normal=await sweep.evaluate(node=>({easing:getComputedStyle(node.firstElementChild).animationTimingFunction,radius:getComputedStyle(node).borderRadius,gradient:getComputedStyle(node.firstElementChild).backgroundImage,animations:node.getAnimations({subtree:true}).map(animation=>({state:animation.playState,...animation.effect.getTiming()}))}))
  assert.equal(normal.radius,'6px');assert(normal.gradient.includes('100deg'));assert.equal(normal.animations.length,1);assert.equal(normal.animations[0].duration,280);assert.equal(normal.easing,'cubic-bezier(0.32, 0.72, 0, 1)')
  await page.screenshot({path:path.join(out,'normal.png'),animations:'disabled'})
  await page.getByRole('button',{name:'Go to slide 1',exact:true}).click();assert.equal(await page.locator('.editor-slide:not([hidden]) [data-working-chart]').count(),0)
  await page.getByRole('button',{name:'Go to slide 3',exact:true}).click();await sweep.waitFor()
  await page.emulateMedia({reducedMotion:'reduce'});await sweep.waitFor({state:'hidden'})
  assert.equal(await page.locator('[data-working-chart]').evaluateAll(nodes=>nodes.flatMap(node=>node.getAnimations({subtree:true})).length),0)
  await page.screenshot({path:path.join(out,'reduced.png'),animations:'disabled'})
  await writeFile(path.join(out,'results.json'),JSON.stringify({normal,reducedAnimations:0,stateDriven:true},null,2));process.stdout.write('PASS working chart normal/reduced motion and slide run state\n')
}finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close();await browser.close()}

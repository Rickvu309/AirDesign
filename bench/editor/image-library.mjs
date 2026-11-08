import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {stack,seed,perform} from "../design-parity/editor-capture.mjs"
import {readRegistry} from "../design-parity/registry.ts"

process.env.NODE_ENV="production"
const out=path.resolve(process.argv[2]??path.join(os.homedir(),"tmp/airdesign-polish/editor/image-library"))
await mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true}),local=await stack(),results=[]
let context
try{
  const entry=(await readRegistry()).find(entry=>entry.code==="S43.03"),setup=await seed(local,entry)
  context=await browser.newContext({viewport:entry.viewport,reducedMotion:"reduce"})
  await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const i=pair.indexOf("=");return {name:pair.slice(0,i),value:pair.slice(i+1),url:local.origin}}))
  const page=await context.newPage();page.setDefaultTimeout(5000)
  await page.goto(local.origin+setup.route);await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
  for(const step of entry.steps)await perform(page,step,local,setup.owner)
  await page.getByRole('combobox',{name:'Image source',exact:true}).selectOption('local-stock')
  await page.waitForFunction(()=>document.querySelectorAll('.image-masonry img').length===10)
  const images=await page.locator('.image-masonry img').evaluateAll(nodes=>nodes.map(node=>({loaded:node.complete&&node.naturalWidth>0,source:node.src})))
  await page.locator('.image-masonry img').evaluateAll(nodes=>Promise.all(nodes.map(node=>node.decode())))
  assert((await page.locator('.image-masonry img').evaluateAll(nodes=>nodes.map(node=>node.complete&&node.naturalWidth>0))).every(Boolean));assert.equal(await page.locator('.aira-panel').count(),1)
  assert.equal(await page.locator('.image-panel').evaluate(node=>node.getBoundingClientRect().width),248)
  assert.equal(await page.locator('.editor-slide:not([hidden]) .slide-preview').evaluate(node=>node.getBoundingClientRect().width),720)
  assert.equal(await page.locator('.image-upload').evaluate(node=>getComputedStyle(node).display),'flex')
  const library=await local.request(setup.owner,'/api/assets');assert.equal(library.assets.length,10)
  for(const image of library.assets){assert.equal(image.provenance.kind,'stock');assert(image.provenance.author);assert.match(image.provenance.source,/^https:/);assert.match(image.provenance.licenseUrl,/^https:/)}
  await page.screenshot({path:path.join(out,'stock.png'),animations:'disabled'})
  for(const image of library.assets)assert.equal((await fetch(local.origin+'/api/assets/'+image.id,{method:'DELETE',headers:{cookie:setup.owner.cookie,origin:local.origin,"content-type":"application/json"},body:"{}"})).status,200)
  await page.reload();await page.getByRole('button',{name:'Images',exact:true}).click();await page.getByRole('combobox',{name:'Image source',exact:true}).selectOption('library')
  await page.getByText('Upload or paste an image to start your personal library. Reuse it in any deck.',{exact:true}).waitFor()
  assert.equal(await page.locator('.image-grid img').count(),0)
  await page.screenshot({path:path.join(out,'empty-library.png'),animations:'disabled'})
  process.stdout.write('PASS real licensed stock thumbnails, provenance, sidebar geometry, Aira, and separate empty library\n')
}finally{if(local.parityFinish)await local.parityFinish();await context?.close();await local.close();await browser.close()}

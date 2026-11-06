import assert from "node:assert/strict"
import {mkdir,writeFile} from "node:fs/promises"
import {randomBytes} from "node:crypto"
import os from "node:os"
import sharp from "sharp"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"

export async function runPerformance({page,stack,call,worker,head,output,create,edit,uid}) {
  const folder=`${output}/perf`;await mkdir(folder,{recursive:true})
  await writeFile(`${folder}/baseline.json`,JSON.stringify({head,base:"9bfe9a4",comparable:false,proof:"main editor dock disables Design and Images; no TemplatePanel or ImagePanel",relativeGate:"N/A; absolute C07 budget"},null,2))
  const entry=await create("100-slide apply measurement"),deck=fixtureDeck(1,100)
  for(const slide of deck.slides)slide.elements[0].theme="default"
  await edit(entry.id,deck.slides.map((value,index)=>({kind:"insert",parent:entry.id,index,value})))
  const coldFonts=[]
  for(let trial=0;trial<4;trial++){
    const context=await page.context().browser().newContext({storageState:await page.context().storageState()}),coldPage=await context.newPage(),fontRequests=[]
    const gate=Promise.withResolvers()
    await coldPage.route("**/*.woff2",async route=>{fontRequests.push(route.request().url());await gate.promise;await route.continue()})
    try{
      await coldPage.goto(stack.origin+`/deck/${entry.id}`,{waitUntil:"domcontentloaded"})
      await coldPage.locator('[data-font-state="loading"]').waitFor();assert.ok(await coldPage.getByText("Loading deck fonts…").isVisible());gate.resolve()
      await coldPage.locator('[data-font-state="ready"]').waitFor({state:"attached"});const waitMs=Number(await coldPage.locator('[data-font-state="ready"]').getAttribute("data-font-wait-ms"));assert.ok(fontRequests.length>=2);coldFonts.push({trial,waitMs,visible:true,requests:fontRequests.length})
    }finally{gate.resolve();await context.close()}
  }
  await page.goto(stack.origin+`/deck/${entry.id}`);await page.locator('[data-sync-state="saved"]').waitFor();await page.evaluate(()=>document.fonts.ready)
  const apply=[]
  for(let index=0;index<24;index++){
    const id=index%2===0 ? "dark" : "light"
    const result=await page.evaluate(async({deck,id})=>{
      const started=performance.now(),response=await fetch("/api/templates/apply",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({deck,id,version:1,requestId:crypto.randomUUID(),mode:"apply-deck",family:"basic"})}),value=await response.json()
      if(!response.ok||value.receipt.kind!=="applied")throw new Error(JSON.stringify(value))
      const responseMs=performance.now()-started,target=id==="dark" ? "rgb(23, 35, 51)" : "rgb(255, 255, 255)"
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{observer.disconnect();reject(new Error(JSON.stringify({code:"template-paint-timeout",slides:document.querySelectorAll(".slide-canvas [data-slide]").length,backgrounds:[...new Set([...document.querySelectorAll(".slide-canvas [data-slide]")].map(slide=>getComputedStyle(slide).backgroundColor))],seq:document.querySelector(".studio-editor").dataset.seq})))},10000);const check=()=>{const slides=[...document.querySelectorAll('.slide-canvas [data-slide]')];if(slides.length===100&&slides.every(slide=>getComputedStyle(slide).backgroundColor===target)){clearTimeout(timeout);observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(resolve))}};const observer=new MutationObserver(check);observer.observe(document.querySelector(".editor-slides"),{subtree:true,attributes:true,childList:true});check()})
      return {ms:performance.now()-started,responseMs,slides:document.querySelectorAll(".editor-slide").length,status:response.status,seq:value.receipt.seq}
    },{deck:entry.id,id})
    assert.equal(result.slides,100);apply.push({...result,cold:index<4})
  }
  const noise=randomBytes(1024*3413*3),photo=await sharp(noise,{raw:{width:1024,height:3413,channels:3}}).png({compressionLevel:0}).toBuffer(),thumbnail=[]
  for(let index=0;index<24;index++){
    const started=performance.now(),job=await call("/api/assets/ingest",{base64:photo.toString("base64"),requestId:uid()},"POST",202);const uploadMs=performance.now()-started;await worker("images");const workerMs=performance.now()-started-uploadMs,status=await call(`/api/assets/jobs/${job.id}`);assert.equal(status.kind,"ready",JSON.stringify(status));const asset=await call(`/api/assets/jobs/${job.id}/adopt`,{}),response=await page.request.get(`${stack.origin}/api/assets/${asset.id}/thumbnail`),bytes=await response.body();assert.equal(response.status(),200);const decoded=await sharp(bytes).raw().toBuffer({resolveWithObject:true});assert.ok(decoded.info.width<=512&&decoded.info.height<=512);thumbnail.push({ms:performance.now()-started,uploadMs,workerMs,inputBytes:photo.length,outputBytes:bytes.length,hash:asset.id,cold:index<4})
  }
  const imageDeck=await create("Crop frame measurement"),slide=fixtureDeck(1).slides[0];await edit(imageDeck.id,[{kind:"insert",parent:imageDeck.id,index:0,value:slide}]);await call("/api/assets/place",{deck:imageDeck.id,slide:"s0",asset:thumbnail[0].hash,elementId:"perfImage",requestId:uid()})
  await page.goto(stack.origin+`/deck/${imageDeck.id}`);await page.locator('[data-sync-state="saved"]').waitFor();await page.getByRole("button",{name:"Images",exact:true}).click();await page.getByLabel("Adjust a placed image").selectOption("perfImage");await page.locator(".image-crop-preview img").waitFor();await page.locator(".image-crop-preview img").evaluate(image=>image.decode())
  const crop=await page.evaluate(async()=>{
    const samples=[],input=document.querySelector('input[aria-label="Crop zoom"]'),preview=document.querySelector(".image-crop-preview img"),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set
    for(let index=0;index<104;index++){
      const started=performance.now(),zoom=index%2===0 ? "2" : "3";setter.call(input,zoom);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{observer.disconnect();reject(new Error("crop-commit-timeout"))},1000),check=()=>{if(preview.style.inlineSize===`${Number(zoom)*100}%`){clearTimeout(timer);observer.disconnect();resolve()}},observer=new MutationObserver(check);observer.observe(preview,{attributes:true});check()});const style=getComputedStyle(preview),ms=performance.now()-started;await new Promise(resolve=>requestAnimationFrame(resolve));samples.push({ms,paintReadyMs:performance.now()-started,inlineSize:style.width,zoom,cold:index<4})
    }
    return samples
  });assert.notEqual(crop[0].inlineSize,crop[1].inlineSize)
  const p95=values=>values.filter(value=>!value.cold).map(value=>value.ms).sort((a,b)=>a-b)[Math.ceil(values.filter(value=>!value.cold).length*.95)-1],measured={apply:p95(apply),thumbnail:p95(thumbnail),crop:p95(crop)}
  await writeFile(`${folder}/raw.json`,JSON.stringify({head,apply,thumbnail,crop,coldFonts},null,2))
  await writeFile(`${folder}/metric.json`,JSON.stringify({head,claim:"Absolute C07 provisional budgets at head; no comparable trunk feature",apply:{start:"Before authenticated HTTP apply",end:"100 slide backgrounds reflect the chosen look, then two animation frames",warm:20,cold:4,phases:"raw responseMs versus total ms separates durable HTTP transaction from websocket delivery, render and frame wait",excludes:"cold fonts, explicitly awaited before timing",coldFontWait:"Four uncached browser contexts hold font responses until the loading status is visible; raw coldFonts reports the separate wait including that gate"},thumbnail:{start:"Before local 10 MB upload",end:"isolated worker finished, adoption durable, real thumbnail fetched and decoded",warm:20,cold:4,bytes:photo.length,phases:"raw uploadMs and workerMs separate transfer from isolated startup/decode/encode; remaining time includes adoption, fetch and full pixel decode",dedupe:"Validation always runs; adoption dedupes after validation"},crop:{start:"Before range input event",end:"Expected crop style committed and computed preview dimensions read",warm:100,cold:4,limiter:"React event processing and crop preview style update",paint:"paintReadyMs separately records next frame after the correct commit; 16 ms gate measures edit work within the frame"},environment:{cores:os.cpus().length,load:os.loadavg()},errors:0},null,2))
  await writeFile(`${folder}/verdict.json`,JSON.stringify({head,p95ms:measured,budgetsMs:{apply:100,thumbnail:2000,crop:16},verdict:measured.apply<=100&&measured.thumbnail<=2000&&measured.crop<=16 ? "pass" : "fail",relativeComparison:"N/A absent trunk features",limitations:"20 warm samples are provisional absolute checks; no statistically supported relative p95 claim"},null,2))
  assert.ok(measured.apply<=100&&measured.thumbnail<=2000&&measured.crop<=16,JSON.stringify(measured))
}

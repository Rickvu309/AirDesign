import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir,writeFile,rm } from "node:fs/promises"
import { chromium,expect } from "playwright/test"
import { localStack,signIn } from "../sync/local-stack.mjs"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
import { createHistoryStore } from "../../apps/server/src/db/history-store.ts"
import { deliverExport } from "../../apps/worker/src/export/deliver.ts"
const output=process.env.P05_OUTPUT ?? `${process.env.HOME}/tmp/airdesign-autopilot/P05/perf`,head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const stack=await localStack(),browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000}}),root=`${process.env.HOME}/tmp/p05-perf-worker-${process.pid}`
await mkdir(output,{recursive:true})
const home=[],input=[],exports=[],events=[],claimTimings=[]
let store
try {
 await signIn(context,stack.origin,"perf@example.com")
 const request=context.request,headers={origin:stack.origin}
 async function call(path,data){const r=await request.fetch(stack.origin+path,{method:data===undefined ? "GET" : "POST",headers,...(data===undefined ? {} : {data})});assert.ok(r.ok(),`${path}: ${await r.text()}`);return r.json()}
 for(let n=0;n<100;n++){const entry=await call("/api/catalog",{requestId:`perf_${n}`,title:`Performance deck ${n}`,pendingRequest:""});assert.ok(entry.id)}
 const state=await context.storageState()
 for(let n=0;n<25;n++){
  const c=n<5 ? await browser.newContext({storageState:state,viewport:{width:1440,height:1000}}) : context
  const page=await c.newPage(),start=performance.now()
  await page.goto(stack.origin);await expect(page.locator(".deck-card")).toHaveCount(100)
  home.push({trial:n,cold:n<5,ms:performance.now()-start,count:100,bytes:await page.evaluate(()=>performance.getEntriesByType("resource").reduce((s,r)=>s+r.transferSize,0))})
  await page.close();if(c!==context)await c.close()
 }
 const fixture={...fixtureDeck(300),id:"perfinput"}
 await call("/api/decks",fixture)
 const page=await context.newPage();await page.goto(`${stack.origin}/deck/perfinput`);await page.locator('[data-sync-state="saved"]').waitFor();assert.equal(await page.locator('[data-element]').count(),300)
 const cdp=await context.newCDPSession(page)
 cdp.on("Tracing.dataCollected",batch=>events.push(...batch.value))
 await cdp.send("Tracing.start",{categories:"devtools.timeline,blink.user_timing",transferMode:"ReportEvents"})
 for(let n=0;n<100;n++){
  input.push(await page.evaluate(index=>new Promise(resolve=>{const field=document.querySelector('[role="textbox"][data-text]');field.focus();performance.mark(`p05-edit-${index}`);const start=performance.now();field.textContent=`Measured edit ${index}`;field.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:String(index)}));requestAnimationFrame(()=>setTimeout(()=>resolve({index,nextPaintTaskMs:performance.now()-start,text:field.textContent}),0))}),n))
  assert.equal(input[n].text,`Measured edit ${n}`)
  await expect.poll(async()=>(await call("/api/decks/perfinput")).deck.slides[0].elements[0].runs[0].text).toBe(`Measured edit ${n}`)
 }
 const done=new Promise(resolve=>cdp.once("Tracing.tracingComplete",resolve));await cdp.send("Tracing.end");await done
 const paints=input.map(s=>{const mark=events.find(e=>e.name===`p05-edit-${s.index}`),paint=events.find(e=>e.name==="Paint"&&e.ts>=mark?.ts);assert.ok(mark&&paint);return {index:s.index,ms:(paint.ts+(paint.dur??0)-mark.ts)/1000}})
 const profile=events.filter(e=>["Layout","UpdateLayoutTree","Paint","FunctionCall","RunTask"].includes(e.name)).reduce((totals,e)=>({...totals,[e.name]:(totals[e.name]??0)+(e.dur??0)/1000}),{})
 store=await createHistoryStore({kind:"postgres",url:stack.url})
 for(let n=0;n<25;n++)for(const format of ["pptx","pdf"]){
  const snap=await call("/api/decks/perfinput"),start=performance.now(),job=await call("/api/catalog/perfinput/exports",{requestId:crypto.randomUUID(),format,slides:[],timing:"now",expectedSeq:snap.seq,allowIssues:false}),ackMs=performance.now()-start
  assert.equal(job.kind,"queued");let claimStart
  const measured={...store.exports,async claim(){const value=await store.exports.claim();if(value)claimStart=performance.now();return value},async complete(...args){const result=await store.exports.complete(...args);claimTimings.push({id:job.id,ms:performance.now()-claimStart});return result}}
  const workStart=performance.now(),delivery=await deliverExport(measured,root)
  assert.equal(delivery?.id,job.id);assert.equal(delivery.committed,true)
  const ready=await call(`/api/catalog/export-jobs/${job.id}`);assert.equal(ready.kind,"ready");assert.equal(ready.seq,snap.seq);assert.deepEqual(ready.report.slideIds,["s0"])
  const bytes=await (await request.get(`${stack.origin}/api/catalog/export-jobs/${job.id}/artifact`)).body();assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,format==="pdf" ? 4 : 2).toString(),format==="pdf" ? "%PDF" : "PK")
  exports.push({trial:n,cold:n<5,format,id:job.id,seq:ready.seq,ackMs,workerMs:claimTimings.at(-1).ms,endToEndMs:performance.now()-start,dispatchMs:performance.now()-workStart,bytes:bytes.length})
 }
 const summary=values=>({count:values.length,p95:values.toSorted((a,b)=>a-b)[Math.ceil(values.length*.95)-1],median:values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)],min:Math.min(...values),max:Math.max(...values)})
 const verdict={head,inputPaint:{...summary(paints.map(s=>s.ms)),budgetMs:16,pass:summary(paints.map(s=>s.ms)).p95<=16},home:{...summary(home.map(s=>s.ms)),budgetMs:2000,pass:home.every(s=>s.ms<=2000)},ack:{...summary(exports.map(s=>s.ackMs)),budgetMs:1000,pass:exports.every(s=>s.ackMs<=1000)},pptx:{...summary(exports.filter(s=>s.format==="pptx").map(s=>s.workerMs)),budgetMs:30000,pass:exports.filter(s=>s.format==="pptx").every(s=>s.workerMs<=30000)},pdf:{...summary(exports.filter(s=>s.format==="pdf").map(s=>s.workerMs)),budgetMs:2000,pass:exports.filter(s=>s.format==="pdf").every(s=>s.workerMs<=2000)}}
 const metric={head,claim:"Absolute P05 budgets on production Studio, PostgreSQL and isolated export worker; no comparable trunk product flow",machine:{load:execFileSync("uptime",[],{encoding:"utf8"}).trim(),cores:execFileSync("nproc",[],{encoding:"utf8"}).trim()},definitions:{input:"100 actual contenteditable input events on a 300-element saved deck; mark to first Chrome Paint end; persisted text asserted for every sample outside timing",home:"5 cold contexts plus 20 warm-cache navigations to 100 owned persisted decks; ends when all 100 cards are usable",exports:"5 cold trials then 20 warm OS-cache trials per format, alternating PPTX/PDF; each isolated process and browser is new; ACK includes HTTP and snapshot transaction; ready starts at successful lease claim and ends at conditional durable result commit"},limiter:{input:"Main-thread event, React projection, style/layout/paint and display refresh cadence",profileMs:profile,home:"HTTP catalog transfer and card rendering; actual transfer bytes per trial recorded",export:"Isolated process start; PPTX XML/ZIP writer; PDF Chromium launch, font load and print plus internal PNG"},errors:0,relativeComparison:"N/A: trunk missing product flows; no relative p95 claim"}
 await writeFile(`${output}/metric.json`,JSON.stringify(metric,null,2));await writeFile(`${output}/samples.json`,JSON.stringify({head,home,input,paints,exports},null,2));await writeFile(`${output}/input-trace.json`,JSON.stringify(events));await writeFile(`${output}/verdict.json`,JSON.stringify(verdict,null,2));process.stdout.write(JSON.stringify(verdict)+"\n")
 assert.ok(Object.values(verdict).filter(v=>typeof v==="object").every(v=>v.pass),"absolute-performance-budget")
}finally{await store?.close();await context.close();await browser.close();await stack.close();await rm(root,{recursive:true,force:true})}

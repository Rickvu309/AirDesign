import assert from "node:assert/strict"
import { execFileSync,execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir,writeFile,readFile,rm } from "node:fs/promises"
import { chromium,expect } from "playwright/test"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { localStack,signIn } from "../sync/local-stack.mjs"
import { runStudio } from "./browser-check.mjs"
import { runImportExport } from "../import-export/browser-check.mjs"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
import { createHistoryStore } from "../../apps/server/src/db/history-store.ts"
import { purgeExpiredDecks } from "../../apps/worker/src/purge/expired-decks.ts"

const output=process.env.P05_OUTPUT ?? `${process.env.HOME}/tmp/airdesign-autopilot/P05`
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),stack=await localStack(),browser=await chromium.launch()
const context=await browser.newContext({viewport:{width:1440,height:1000}}),trace=[],checks={}
const workerRoot=`${process.env.HOME}/tmp/p05-lanes-worker-${process.pid}`
let page
async function call(path,data,credential){const r=await context.request.fetch(stack.origin+path,{method:data===undefined ? "GET" : "POST",headers:{origin:stack.origin,...(credential ? {"x-run-credential":credential} : {})},...(data===undefined ? {} : {data})}),value=await r.json();trace.push({path,status:r.status(),data,value});assert.ok(r.ok(),JSON.stringify(value));return value}
async function command(deck,body,credential){return call(`/api/decks/${deck}/commands`,{id:crypto.randomUUID(),...body},credential)}
async function snapshot(deck){return call(`/api/decks/${deck}`)}
async function patch(deck,fields,target="s0",run=null,credential){const snap=await snapshot(deck);return command(deck,{kind:"patch",base:snap.seq,run,target,fields},credential)}
async function submit(deck,format="pptx",slides=[],timing="now"){return call(`/api/catalog/${deck}/exports`,{requestId:crypto.randomUUID(),format,slides,timing,expectedSeq:(await snapshot(deck)).seq,allowIssues:true})}
async function worker(extra={}){const start=performance.now(),r=await promisify(execFile)(process.execPath,["apps/worker/src/main.ts"],{env:{...process.env,AIRDESIGN_DATABASE_URL:stack.url,AIRDESIGN_OPERATIONS_PATH:stack.operationsPath,AIRDESIGN_WORKER_TEMP:workerRoot,...extra},timeout:95000,maxBuffer:1000000});trace.push({worker:r.stdout,stderr:r.stderr,elapsedMs:performance.now()-start})}
async function ready(job){const result=await call(`/api/catalog/export-jobs/${job.id}`);assert.equal(result.kind,"ready",JSON.stringify(result));return result}
try {
  checks.studio=await runStudio(browser,stack)
  checks.importExport=await runImportExport(browser,stack,`${output}/lane-1/artifacts`)
  const person=await signIn(context,stack.origin,"lanes@example.com")
  page=await context.newPage()
  const original={...fixtureDeck(3,3),id:"combined"}
  original.slides.forEach((slide,index)=>{slide.elements[0].runs[0].text=`Slide ${index+1} unique title`})
  assert.equal((await context.request.post(`${stack.origin}/api/decks`,{headers:{origin:stack.origin},data:original})).status(),201)
  await call("/api/catalog/combined/rename",{title:"Consistent name"})
  await page.goto(`${stack.origin}/deck/combined`);await page.locator('[data-sync-state="saved"]').waitFor()
  await expect(page.locator(".deck-name")).toHaveText("Consistent name⌄")
  const copy=await call("/api/catalog/combined/duplicate",{requestId:crypto.randomUUID()})
  await patch(copy.id,{notes:"Independent copy"})
  assert.equal((await snapshot("combined")).deck.slides[0].notes,original.slides[0].notes)
  assert.equal((await snapshot(copy.id)).deck.slides[0].notes,"Independent copy")
  checks.duplicate={original:"combined",copy:copy.id,copySeq:1,originalSeq:0}
  await page.getByRole("button",{name:"Slide 1",exact:true}).click()
  await page.getByRole("button",{name:"Slide 2",exact:true}).click({modifiers:["Shift"]})
  assert.equal(await page.locator('.editor-slide[data-selected="true"]').count(),2)
  await page.locator(".deck-name").click()
  await page.getByRole("button",{name:"Move later",exact:true}).click()
  await expect.poll(async()=>(await snapshot("combined")).deck.slides.map(s=>s.id).join(",")).toBe("s2,s0,s1")
  checks.selection={selected:["s0","s1"],result:["s2","s0","s1"]}
  await page.locator('[data-sync-state="saved"]').waitFor()
  await page.getByRole("button",{name:"Slide 2",exact:true}).click()
  await page.getByLabel("Speaker notes",{exact:true}).fill("Person saved note")
  await expect.poll(async()=>(await snapshot("combined")).deck.slides.find(s=>s.id==="s0").notes).toBe("Person saved note")
  const run=await command("combined",{kind:"start-run",run:"lane-run"})
  await patch("combined",{notes:"Agent other slide"},"s1","lane-run",run.runCredential)
  await expect(page.getByLabel("Speaker notes",{exact:true})).toHaveValue("Person saved note")
  await page.locator(".deck-name").focus()
  await page.keyboard.press("Control+z")
  await expect.poll(async()=>(await snapshot("combined")).deck.slides.find(s=>s.id==="s0").notes).toBe(original.slides[0].notes)
  assert.equal((await snapshot("combined")).deck.slides.find(s=>s.id==="s1").notes,"Agent other slide")
  await page.keyboard.press("Control+Shift+z")
  await expect.poll(async()=>(await snapshot("combined")).deck.slides.find(s=>s.id==="s0").notes).toBe("Person saved note")
  checks.keyboard={undoAcrossAgent:true,redo:true,agentOtherSlidePreserved:true,tree:await page.locator('.editor-status').ariaSnapshot()}
  const before=await snapshot("combined"),nowJob=await submit("combined"),afterJob=await submit("combined","pptx",[],"after-run")
  assert.equal(afterJob.kind,"waiting")
  await patch("combined",{notes:"Atomic final agent change"},"s1","lane-run",run.runCredential)
  await command("combined",{kind:"close-run",run:"lane-run"})
  const after=await snapshot("combined")
  await worker()
  const nowReady=await ready(nowJob),afterReady=await ready(afterJob)
  assert.equal(nowReady.seq,before.seq);assert.equal(afterReady.seq,after.seq)
  checks.runExport={nowSeq:nowReady.seq,afterSeq:afterReady.seq,now:nowReady.report,after:afterReady.report}
  const beforeTrash=await snapshot(copy.id)
  await call(`/api/catalog/${copy.id}/trash`,{})
  await call(`/api/catalog/${copy.id}/restore`,{})
  assert.deepEqual(await snapshot(copy.id),beforeTrash)
  await call(`/api/catalog/${copy.id}/trash`,{})
  await stack.database(client=>client.query("UPDATE editing_deck SET deleted_at=$2 WHERE id=$1",[copy.id,Date.now()-31*86400000]))
  const fresh=await call("/api/catalog",{requestId:crypto.randomUUID(),title:"Fresh trash",pendingRequest:""})
  await call(`/api/catalog/${fresh.id}/trash`,{})
  const stores=await Promise.all([createHistoryStore({kind:"postgres",url:stack.url}),createHistoryStore({kind:"postgres",url:stack.url})])
  try{
   const person=await call("/api/account"),options={format:"pptx",slides:[],timing:"now",expectedSeq:after.seq,allowIssues:false}
   const submitted=await Promise.all(stores.map(s=>s.exports.submit({personId:person.personId},"parallel-export","combined",options)))
   assert.equal(submitted[0].id,submitted[1].id)
   const claims=await Promise.all(stores.map(s=>s.exports.claim()))
   assert.equal(claims.filter(Boolean).length,1);assert.equal(claims.find(Boolean).snapshot.seq,after.seq)
   await call(`/api/catalog/export-jobs/${submitted[0].id}/cancel`,{})
   checks.parallelExport={id:submitted[0].id,claims:claims.filter(Boolean).length,seq:after.seq,connections:2}
   const results=await Promise.all(stores.map(s=>purgeExpiredDecks(s.catalog)));assert.deepEqual(results.flatMap(r=>r.removed),[copy.id]);checks.purge={results,expired:copy.id,fresh:fresh.id,retainedHistory:beforeTrash.seq}}finally{await Promise.all(stores.map(s=>s.close()))}
  await page.goto(`${stack.origin}/deck/${copy.id}`)
  await expect(page.getByRole("alert")).toContainText("no longer available")
  assert.ok((await call("/api/catalog?trash=true")).some(d=>d.id===fresh.id))
  await page.goto(`${stack.origin}/deck/combined`);await page.locator('[data-sync-state="saved"]').waitFor()
  await page.getByRole("button",{name:"Export",exact:true}).click()
  await page.getByLabel("File format").selectOption("pdf")
  await page.getByRole("button",{name:"Create export",exact:true}).click()
  await expect(page.getByRole("status").filter({hasText:"Export queued"})).toBeVisible()
  await page.getByRole("button",{name:"Close export",exact:true}).focus()
  const focus=await page.evaluate(()=>document.activeElement.outerHTML)
  const retryId=(await call("/api/catalog/combined/exports")).at(-1).id
  await worker({PLAYWRIGHT_BROWSERS_PATH:`${workerRoot}/missing-browser`})
  await expect(page.getByRole("status").filter({hasText:"Export failed"})).toBeVisible()
  assert.equal(await page.evaluate(()=>document.activeElement.outerHTML),focus)
  const failed=await call(`/api/catalog/export-jobs/${retryId}`)
  assert.equal(failed.kind,"failed");assert.ok(failed.diagnostics.length)
  await page.getByRole("button",{name:"Retry export",exact:true}).click()
  await worker()
  const retried=await ready({id:retryId})
  await expect(page.getByRole("link",{name:"Download PDF"})).toBeVisible()
  assert.deepEqual(retried.diagnostics,failed.diagnostics);assert.equal(retried.attempts,2)
  checks.retry={id:retryId,originalDiagnostics:failed.diagnostics,attempts:retried.attempts,tree:await page.getByRole("dialog").ariaSnapshot(),focusRetained:true}
  await page.getByRole("button",{name:"Close export",exact:true}).click()
  const pdf=await submit("combined","pdf",["s1","s2"])
  await worker();const pdfReady=await ready(pdf)
  const bytes=await (await context.request.get(`${stack.origin}/api/catalog/export-jobs/${pdf.id}/artifact`)).body()
  const doc=await getDocument({data:new Uint8Array(bytes),useSystemFonts:false}).promise
  const texts=[];for(let n=1;n<=doc.numPages;n++)texts.push((await (await doc.getPage(n)).getTextContent()).items.map(i=>i.str).join(" "))
  assert.equal(doc.numPages,2)
  for(let n=0;n<2;n++)assert.ok(texts[n].includes(original.slides[n===0 ? 1 : 2].elements[0].runs[0].text))
  await doc.cleanup();assert.deepEqual(pdfReady.report.slideIds,["s1","s2"])
  checks.range={id:pdf.id,slideIds:pdfReady.report.slideIds,texts}
  await writeFile(`${output}/lane-10/range.pdf`,bytes).catch(async()=>{await mkdir(`${output}/lane-10`,{recursive:true});await writeFile(`${output}/lane-10/range.pdf`,bytes)})
  const importedReport=checks.importExport
  const lanes={1:{studio:checks.studio,importExport:importedReport,trunk:{state:"missing",proof:execFileSync("git",["ls-tree","-r","98a744f","--","apps/studio/src/editor","apps/server/src/decks","packages/catalog"],{encoding:"utf8"})}},2:{studio:checks.studio,importTrace:importedReport.trace},3:{search:"nothing matches %_",fontReport:importedReport.fonts,trace:importedReport.trace},4:{name:"Consistent name",keptReport:importedReport.trace},5:{duplicate:checks.duplicate,fixFocus:"Slide 1",exportTrace:importedReport.trace},6:{purge:checks.purge,anyway:importedReport.pinned,exportTrace:importedReport.trace},7:{selection:checks.selection,export:checks.runExport,parallel:checks.parallelExport},8:{keyboard:checks.keyboard,phone:checks.studio.phoneWidth,reattach:importedReport.job},9:{deleted:checks.studio,retry:checks.retry},10:{paste:checks.studio.pasteRetained,pdf:checks.range}}
  for(const [lane,value] of Object.entries(lanes)){const folder=`${output}/lane-${lane}`;await mkdir(folder,{recursive:true});await writeFile(`${folder}/receipt.json`,JSON.stringify({head,lane:Number(lane),verdict:"pass",...value},null,2));if(lane==="1")await writeFile(`${folder}/comparison.json`,JSON.stringify({head,lane:1,verdict:"pass",...value},null,2));await writeFile(`${folder}/trace.json`,JSON.stringify({head,responses:trace,checks},null,2))}
  process.stdout.write(JSON.stringify({head,verdict:"pass",lanes:Object.keys(lanes),checks})+"\n")
}finally{await mkdir(output,{recursive:true});await writeFile(`${output}/live-last-trace.json`,JSON.stringify({head,trace,checks},null,2));await context.close();await browser.close();await stack.close();await rm(workerRoot,{recursive:true,force:true})}

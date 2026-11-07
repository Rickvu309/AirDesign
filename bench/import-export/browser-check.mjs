import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { readFile,mkdir,writeFile } from "node:fs/promises"
import { chromium,expect } from "playwright/test"
import { localStack,signIn } from "../sync/local-stack.mjs"
import { importPptx } from "../../packages/pptx/src/index.ts"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { fontManifest } from "../../packages/render/src/font-manifest.ts"

export async function runImportExport(browser,stack,output) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),trace=[]
  await signIn(context,stack.origin,"export-owner@example.com")
  const headers={origin:stack.origin},request=context.request
  async function call(path,data,method=data===undefined ? "GET" : "POST"){const response=await request.fetch(stack.origin+path,{method,headers,...(data===undefined ? {} : {data})});const value=await response.json();trace.push({path,method,status:response.status(),value});assert.ok(response.ok(),JSON.stringify(value));return value}
  async function worker(){const started=performance.now();const result=await promisify(execFile)(process.execPath,["apps/worker/src/main.ts"],{env:{...process.env,AIRDESIGN_DATABASE_URL:stack.url,AIRDESIGN_OPERATIONS_PATH:stack.operationsPath,AIRDESIGN_WORKER_TEMP:`${process.env.HOME}/tmp/p05-worker-${process.pid}`},timeout:65000,maxBuffer:1000000});trace.push({worker:result.stdout,elapsedMs:performance.now()-started,stderr:result.stderr});return performance.now()-started}
  let page=await context.newPage()
  try {
    await page.goto(stack.origin)
    await page.getByRole("button",{name:"New deck",exact:true}).click()
    await page.getByRole("button",{name:"Import PowerPoint",exact:true}).click()
    await page.getByLabel("Import PowerPoint",{exact:true}).setInputFiles({name:"broken.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:Buffer.from([0x50,0x4b,3,4,0,0,0,0])})
    await expect(page.getByRole("status").filter({hasText:"Importing PowerPoint…"})).toBeVisible()
    await worker()
    await expect(page.getByRole("alert").filter({hasText:"Unable to import this file"})).toBeVisible()
    assert.equal((await call("/api/catalog?trash=false")).length,0)
    const input=await readFile("fixtures/pptx/preservation.pptx")
    await page.getByRole("button",{name:"Choose another file",exact:true}).click({noWaitAfter:true})
    await page.getByLabel("Import PowerPoint",{exact:true}).setInputFiles({name:"Strategy.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:input})
    await expect(page.getByRole("status").filter({hasText:"Importing PowerPoint…"})).toBeVisible()
    await worker()
    await expect(page.locator(".import-report")).toBeVisible()
    await expect(page.locator(".import-report")).toContainText("Native")
    await expect(page.locator(".import-report")).toContainText("Kept")
    await expect(page.locator(".import-report")).toContainText("Flagged")
    await page.getByRole("button",{name:"Keep and open deck",exact:true}).click()
    await page.waitForURL(/\/deck\//)
    const imported=page.url().split("/").at(-1)
    await page.locator('[data-sync-state="saved"]').waitFor()
    await expect(page.locator(".slide-disclosure").first()).toContainText("Kept original")
    await expect(page.locator("[data-font-warning]").first()).toContainText("Missing fonts")
    const title=page.getByRole("textbox",{name:"Text s0t0",exact:true})
    await title.fill("Edited imported title")
    await page.locator('[data-sync-state="saved"]').waitFor()
    await page.getByRole("button",{name:"Export",exact:true}).click()
    await expect(page.getByRole("dialog")).toContainText("Review before exporting")
    await page.getByRole("button",{name:"Fix slide 1",exact:true}).click()
    await expect(page.getByRole("button",{name:"Slide 1",exact:true})).toBeFocused()
    await page.getByRole("button",{name:"Export",exact:true}).click()
    await call(`/api/catalog/${imported}/rename`,{title:"Quarterly / Strategy"})
    await page.getByRole("button",{name:"Export anyway",exact:true}).click()
    await expect(page.getByRole("status").filter({hasText:"Export queued"})).toBeVisible()
    const jobs=await call(`/api/catalog/${imported}/exports`),jobId=jobs.at(-1).id
    const pinned=await call(`/api/catalog/export-jobs/${jobId}`)
    const savedBefore=await call(`/api/decks/${imported}`)
    await call(`/api/decks/${imported}/commands`,{id:crypto.randomUUID(),kind:"patch",base:savedBefore.seq,run:null,target:"s0",fields:{notes:"Later note excluded"}})
    await call(`/api/catalog/${imported}/rename`,{title:"Later name"})
    await page.close();await worker()
    const result=await call(`/api/catalog/export-jobs/${jobId}`);assert.equal(result.kind,"ready",JSON.stringify(result));assert.equal(result.seq,savedBefore.seq);assert.equal(result.report.seq,savedBefore.seq);assert.deepEqual(result.report.fontManifest,fontManifest)
    assert.equal(result.report.acknowledged,true);assert.ok(result.report.flags.length>0)
    const artifact=await request.get(`${stack.origin}/api/catalog/export-jobs/${jobId}/artifact`)
    assert.equal(artifact.headers()["content-disposition"],`attachment; filename="Quarterly _ Strategy-v${savedBefore.seq}.pptx"`)
    const bytes=Buffer.from(await artifact.body()),pptx=await importPptx(bytes),original=await importPptx(input)
    const preserved=[...original.parts].filter(([name])=>!name.endsWith(".xml")&&!name.endsWith(".rels"))
    assert.ok(preserved.length>0);for(const [name,content] of preserved)assert.deepEqual(pptx.parts.get(name),content,name)
    const manifest=JSON.parse(pptx.parts.get("airdesign/saved-version.json").toString());assert.equal(manifest.seq,savedBefore.seq);assert.equal(manifest.deck.slides[0].notes,savedBefore.deck.slides[0].notes);assert.ok(pptx.parts.get("ppt/slides/slide1.xml").toString().includes("Edited imported title"))
    page=await context.newPage();await page.goto(`${stack.origin}/deck/${imported}`);await page.locator('[data-sync-state="saved"]').waitFor();await page.getByRole("button",{name:"Export",exact:true}).click();await expect(page.getByRole("link",{name:"Download PPTX",exact:true})).toBeVisible()
    assert.ok((await call(`/api/catalog/${imported}/exports`)).some(job=>job.id===jobId))
    const current=await call(`/api/decks/${imported}`),pdf=await call(`/api/catalog/${imported}/exports`,{requestId:crypto.randomUUID(),format:"pdf",timing:"now",expectedSeq:current.seq,slides:[current.deck.slides[0].id],allowIssues:true})
    const pdfElapsed=await worker(),pdfResult=await call(`/api/catalog/export-jobs/${pdf.id}`)
    assert.equal(pdfResult.kind,"ready",JSON.stringify(pdfResult))
    const pdfBytes=Buffer.from(await (await request.get(`${stack.origin}/api/catalog/export-jobs/${pdf.id}/artifact`)).body());assert.equal(pdfBytes.subarray(0,5).toString(),"%PDF-")
    const directory=output ?? `${process.env.HOME}/tmp/p05-export-proof-${process.pid}`;await mkdir(directory,{recursive:true});await writeFile(`${directory}/saved.pptx`,bytes);await writeFile(`${directory}/saved.pdf`,pdfBytes)
    const document=await getDocument({data:new Uint8Array(pdfBytes),useSystemFonts:false}).promise;assert.equal(document.numPages,1);const text=(await (await document.getPage(1)).getTextContent()).items.map(item=>"str" in item ? item.str : "").join(" ");assert.ok(text.includes("Edited imported title"),text);await document.cleanup();assert.deepEqual(pdfResult.report.slideIds,[current.deck.slides[0].id])
    await page.close()
    for(let tab=0;tab<2;tab++){
      const recovered=await context.newPage();await recovered.goto(`${stack.origin}/deck/${imported}`);await recovered.locator('[data-sync-state="saved"]').waitFor();await recovered.getByRole("button",{name:"Export",exact:true}).click()
      const retained=recovered.getByLabel("Retained exports",{exact:true});await expect(retained.locator("option")).toHaveCount(2)
      for(const [id,format] of [[jobId,"PPTX"],[pdf.id,"PDF"]]){await retained.selectOption(id);await expect(recovered.getByRole("link",{name:`Download ${format}`,exact:true})).toHaveAttribute("href",`/api/catalog/export-jobs/${id}/artifact`)}
      await recovered.close()
    }
    trace.push({recovery:"two closed submission tabs, two fresh tabs, both formats retained",jobs:[jobId,pdf.id]})
    await writeFile(`${directory}/trace.json`,JSON.stringify(trace,null,2))
    return {verdict:"pass",imported,job:jobId,savedSeq:savedBefore.seq,pdf:pdf.id,pdfWorkerMs:pdfElapsed,trace:`${directory}/trace.json`,pinned,fonts:fontManifest}
  } finally {await context.close()}
}
if(import.meta.url===`file://${process.argv[1]}`){const stack=await localStack(),browser=await chromium.launch();try{process.stdout.write(JSON.stringify(await runImportExport(browser,stack,process.env.P05_OUTPUT))+"\n")}finally{await browser.close();await stack.close()}}

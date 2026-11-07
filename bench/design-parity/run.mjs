import {mkdir,writeFile,readFile,readdir,copyFile} from "node:fs/promises"
import {execFileSync} from "node:child_process"
import crypto from "node:crypto"
import {syncBuiltinESMExports} from "node:module"
import os from "node:os"
import path from "node:path"
import {preview} from "vite"
import {chromium} from "playwright"
import sharp from "sharp"
import {PNG} from "pngjs"
import pixelmatch from "pixelmatch"
import {readRegistry,readBudgetBaseline,validateRegistry,selectScenarios,ratchet} from "./registry.ts"
import {stack,seed,perform} from "./capture.mjs"
import {fixtureIdentifier} from "./fixture-identifiers.ts"
const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0 ? undefined : args[index+1]}
if(args.some(arg=>arg.startsWith("--")&&!["--only","--out","--update-budgets","--skip-build"].includes(arg)))throw new Error("unknown-option")
for(const name of ["--out","--only"])if(args.includes(name)&&(!option(name)||option(name).startsWith("--")))throw new Error("missing-option-value")
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),out=path.resolve(option("--out") ?? path.join(os.homedir(),"tmp/airdesign-design-parity",head))
await mkdir(out,{recursive:true})
const entries=await readRegistry(),baseline=await readBudgetBaseline()
validateRegistry(entries,await readdir("docs/design/v0.1/screens"),baseline)
const selected=selectScenarios(entries,option("--only")),results=[]
if(!args.includes("--skip-build"))for(const workspace of ["apps/studio","apps/site"])execFileSync("npm",["run","build","--workspace",workspace],{stdio:"inherit"})
let local,site,browser
const originalUUID=crypto.randomUUID,originalTemp=process.env.TMPDIR
process.env.TMPDIR=path.join(os.homedir(),"tmp")
await mkdir(process.env.TMPDIR,{recursive:true})
const escape=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")
try{
  site=await preview({root:path.resolve("apps/site"),preview:{host:"127.0.0.1",port:0}})
  const siteAddress=site.httpServer.address(),siteOrigin=`http://127.0.0.1:${siteAddress.port}`
  browser=await chromium.launch({headless:true})
  for(const entry of selected){
    if(entry.status==="unreachable"){results.push({...entry});continue}
    const directory=path.join(out,entry.code);await mkdir(directory,{recursive:true})
    let context,page
    try{
      let identifier=0
      crypto.randomUUID=()=>fixtureIdentifier(entry.code,identifier++)
      syncBuiltinESMExports()
      local=await stack()
      const setup=await seed(local,entry)
      context=await browser.newContext({viewport:entry.viewport,locale:"en-US",timezoneId:"UTC",colorScheme:"light",reducedMotion:"reduce",deviceScaleFactor:1})
      if(setup.owner)await context.addCookies(setup.owner.cookie.split("; ").map(pair=>{const index=pair.indexOf("=");return {name:pair.slice(0,index),value:pair.slice(index+1),url:local.origin}}))
      page=await context.newPage();page.setDefaultTimeout(10000)
      await page.clock.setFixedTime(new Date("2026-11-06T03:00:00Z"))
      await page.goto((entry.surface==="site" ? siteOrigin : local.origin)+setup.route,{waitUntil:"load"})
      if(entry.seed.startsWith("deck-"))await page.locator('.studio-editor[data-sync-state="saved"]').waitFor()
      else await page.waitForLoadState("networkidle")
      for(const step of entry.steps)await perform(page,step,local,setup.owner)
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)))})
      if(!entry.steps.some(step=>step.kind==="hover"))await page.mouse.move(0,0)
      const capture=await page.screenshot({animations:"disabled",caret:"hide",fullPage:entry.code==="S11.01"})
      await writeFile(path.join(directory,"capture.png"),capture)
      await copyFile(entry.design,path.join(directory,"design.png"))
      const design=await readFile(entry.design),a=await sharp(design).metadata(),b=await sharp(capture).metadata(),width=Math.max(a.width,b.width),height=Math.max(a.height,b.height)
      const pad=async(buffer,meta)=>PNG.sync.read(await sharp(buffer).ensureAlpha().extend({right:width-meta.width,bottom:height-meta.height,background:"#ffffff"}).png().toBuffer())
      const left=await pad(design,a),right=await pad(capture,b),diff=new PNG({width,height})
      const pixels=pixelmatch(left.data,right.data,diff.data,width,height,{threshold:0.1,includeAA:false}),ratio=pixels/(width*height)
      await writeFile(path.join(directory,"diff.png"),PNG.sync.write(diff))
      await sharp({create:{width:width*2,height,channels:4,background:"#ffffff"}}).composite([{input:PNG.sync.write(left),left:0,top:0},{input:PNG.sync.write(right),left:width,top:0}]).png().toFile(path.join(directory,"side-by-side.png"))
      const fonts=await page.evaluate(()=>[...new Set([...document.querySelectorAll("h1,h2,button,p")].map(element=>getComputedStyle(element).fontFamily))])
      results.push({...entry,ratio,pixels,comparison:{width,height,design:{width:a.width,height:a.height},capture:{width:b.width,height:b.height}},fonts,passed:ratio<=entry.budget,artifacts:{capture:`${entry.code}/capture.png`,design:`${entry.code}/design.png`,diff:`${entry.code}/diff.png`,sideBySide:`${entry.code}/side-by-side.png`}})
      process.stdout.write(`${entry.code} ${ratio.toFixed(9)} ${ratio<=entry.budget ? "PASS" : "REGRESSION"}\n`)
    }catch(error){if(page)await page.screenshot({animations:"disabled",caret:"hide"}).then(buffer=>writeFile(path.join(directory,"capture-error.png"),buffer)).catch(()=>undefined);results.push({...entry,status:"error",error:String(error),passed:false});process.stderr.write(`${entry.code} ${String(error)}\n`)}finally{if(local?.parityFinish){await local.parityFinish();delete local.parityFinish}await context?.close();await local?.close();local=undefined}
  }
}finally{
  crypto.randomUUID=originalUUID
  syncBuiltinESMExports()
  await browser?.close()
  if(site)await new Promise(resolve=>site.httpServer.close(resolve))
  await local?.close()
  if(originalTemp===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=originalTemp
}
if(args.includes("--update-budgets")){
  for(const result of results){if(typeof result.ratio!=="number")continue;const entry=entries.find(entry=>entry.code===result.code);entry.budget=ratchet(entry.budget,result.ratio);result.budget=entry.budget}
  await writeFile(new URL("./scenarios.json",import.meta.url),JSON.stringify(entries,null,2)+"\n")
}
results.sort((a,b)=>(b.ratio ?? -1)-(a.ratio ?? -1))
const report={head,clock:"2026-11-06T03:00:00Z",pixelmatch:{threshold:0.1,includeAA:false,normalization:"white padding only; no resizing or masking"},results}
await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n")
const cards=[...results].sort((a,b)=>(b.ratio ?? -1)-(a.ratio ?? -1)).map(entry=>`<article><h2>${entry.code} ${entry.ratio===undefined ? entry.status : (entry.ratio*100).toFixed(4)+"%"}</h2><p>${escape(entry.reason ?? entry.error ?? `${entry.seed} · budget ${entry.budget}`)}</p>${entry.artifacts ? `<p>Design left · product right · <a href="${entry.artifacts.diff}">pixel diff</a></p><a href="${entry.artifacts.sideBySide}"><img width="100%" src="${entry.artifacts.sideBySide}" alt="${entry.code} design left and product right"></a>` : ""}</article>`).join("\n")
await writeFile(path.join(out,"report.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><title>AirDesign parity ${head}</title><style>body{margin:24px;font-family:system-ui;background:#f5f5f5}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,680px),1fr));gap:24px}article{padding:16px;background:white;border:1px solid #ddd;border-radius:12px;min-width:0}img{display:block;height:auto}</style><h1>AirDesign design parity</h1><p>Product baseline ${head}. Worst ratios first. Unreachable entries remain coverage gaps.</p><main>${cards}</main></html>`)
process.stdout.write(`Report ${path.join(out,"report.html")}\n`)
if(results.some(entry=>entry.passed===false))process.exitCode=1

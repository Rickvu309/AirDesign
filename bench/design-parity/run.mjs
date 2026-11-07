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
import {compareDesign,metricVersion} from "./metric.mjs"
import {readRegistry,readBudgetBaseline,validateIdentity,validateRegistry,selectScenarios,ratchet,passesParity} from "./registry.ts"
import {assertScenarioCopy,assertScenarioDOM,probeScenarioInteraction} from "./dom-assertions.ts"
import {stack,seed,perform} from "./capture.mjs"
import {fixtureIdentifier} from "./fixture-identifiers.ts"
import {approvalRoute} from "./approval-fixture.ts"
const args=process.argv.slice(2),option=name=>{const index=args.indexOf(name);return index<0 ? undefined : args[index+1]}
if(args.some(arg=>arg.startsWith("--")&&!["--only","--out","--update-budgets","--skip-build","--strict"].includes(arg)))throw new Error("unknown-option")
for(const name of ["--out","--only"])if(args.includes(name)&&(!option(name)||option(name).startsWith("--")))throw new Error("missing-option-value")
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),out=path.resolve(option("--out") ?? path.join(os.homedir(),"tmp/airdesign-design-parity",head))
await mkdir(out,{recursive:true})
const entries=await readRegistry(),baseline=await readBudgetBaseline()
await validateIdentity(entries)
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
    if(entry.status==="unreachable"){results.push({...entry,passed:!args.includes("--strict")});continue}
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
      await assertScenarioCopy(page,entry.assertions.entryCopyKeys??[])
      await probeScenarioInteraction(page,entry)
      if(entry.assertions.probe.kind==="approval")await page.goto(local.origin+await approvalRoute(local.origin,local.fixture.apiOrigin,entry.seed.slice(6)),{waitUntil:"networkidle"})
      for(const step of entry.steps)await perform(page,step,local,setup.owner)
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>undefined)))})
      if(!entry.steps.some(step=>step.kind==="hover"))await page.mouse.move(0,0)
      let structureError
      try{await assertScenarioDOM(page,entry)}catch(error){structureError=String(error)}
      const capture=await page.screenshot({animations:"disabled",caret:"hide",fullPage:entry.code==="S11.01"})
      await writeFile(path.join(directory,"capture.png"),capture)
      await copyFile(entry.design,path.join(directory,"design.png"))
      const design=await readFile(entry.design)
      const {score,globalScore,colorLoss,localLoss,worstRegion,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss,ratio,pixels,left,right,diff,comparison}=await compareDesign(design,capture)
      const {width,height}=comparison
      await writeFile(path.join(directory,"diff.png"),PNG.sync.write(diff))
      await sharp({create:{width:width*2,height,channels:4,background:"#ffffff"}}).composite([{input:PNG.sync.write(left),left:0,top:0},{input:PNG.sync.write(right),left:width,top:0}]).png().toFile(path.join(directory,"side-by-side.png"))
      const fonts=await page.evaluate(()=>[...new Set([...document.querySelectorAll("h1,h2,button,p")].map(element=>getComputedStyle(element).fontFamily))])
      results.push({...entry,score,globalScore,colorLoss,localLoss,worstRegion,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss,ratio,pixels,comparison,fonts,distanceToTarget:score-entry.target,pixelPassed:passesParity(entry,score,args.includes("--strict")),structurePassed:structureError===undefined,structureError,passed:structureError===undefined&&passesParity(entry,score,args.includes("--strict")),artifacts:{capture:`${entry.code}/capture.png`,design:`${entry.code}/design.png`,diff:`${entry.code}/diff.png`,sideBySide:`${entry.code}/side-by-side.png`}})
      process.stdout.write(`${entry.code} ${score.toFixed(9)} raw=${ratio.toFixed(9)} ${results.at(-1).passed ? "PASS" : "REGRESSION"}\n`)
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
  for(const result of results){if(typeof result.score!=="number")continue;const entry=entries.find(entry=>entry.code===result.code);entry.budget=ratchet(entry.budget,result.score);result.budget=entry.budget}
  await writeFile(new URL("./scenarios.json",import.meta.url),JSON.stringify(entries,null,2)+"\n")
}
results.sort((a,b)=>(b.score ?? -1)-(a.score ?? -1))
const report={head,metric:metricVersion,strict:args.includes("--strict"),clock:"2026-11-06T03:00:00Z",pixelmatch:{threshold:0.1,includeAA:false,normalization:"white padding only; no resizing or masking"},results}
await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2)+"\n")
const table=`<table><thead><tr><th>Screen</th><th>Drift</th><th>Global</th><th>Worst region (column,row)</th><th>Raw ratio</th><th>Budget</th><th>Target</th><th>Distance to target</th><th>Pixels</th><th>Structure</th></tr></thead><tbody>${results.map(entry=>`<tr><td>${entry.code}</td><td>${entry.score?.toFixed(6) ?? entry.status}</td><td>${entry.globalScore?.toFixed(6) ?? "—"}</td><td>${entry.worstRegion ? `${entry.worstRegion.column},${entry.worstRegion.row}: ${entry.localLoss.toFixed(6)}` : "—"}</td><td>${entry.ratio?.toFixed(6) ?? "—"}</td><td>${entry.budget}</td><td>${entry.target}</td><td>${entry.distanceToTarget?.toFixed(6) ?? "—"}</td><td>${entry.pixelPassed ?? "—"}</td><td>${escape(entry.structureError ?? entry.structurePassed ?? "—")}</td></tr>`).join("")}</tbody></table>`
const cards=[...results].sort((a,b)=>(b.score ?? -1)-(a.score ?? -1)).map(entry=>`<article><h2>${entry.code} ${entry.score===undefined ? entry.status : "drift "+entry.score.toFixed(6)}</h2><p>${escape(entry.reason ?? entry.error ?? entry.structureError ?? `${entry.seed} · budget ${entry.budget} · target ${entry.target} · distance ${entry.distanceToTarget?.toFixed(6)} · raw ratio ${entry.ratio?.toFixed(6)}`)}</p>${entry.artifacts ? `<p>Design left · product right · <a href="${entry.artifacts.diff}">pixel diff</a></p><a href="${entry.artifacts.sideBySide}"><img width="100%" src="${entry.artifacts.sideBySide}" alt="${entry.code} design left and product right"></a>` : ""}</article>`).join("\n")
await writeFile(path.join(out,"report.html"),`<!doctype html><html lang="en"><meta charset="utf-8"><title>AirDesign parity ${head}</title><style>body{margin:24px;font-family:system-ui;background:#f5f5f5}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,680px),1fr));gap:24px}article{padding:16px;background:white;border:1px solid #ddd;border-radius:12px;min-width:0}img{display:block;height:auto}</style><h1>AirDesign design parity</h1><p>Product baseline ${head}. Worst drift first. Drift is the maximum of the global terms and the worst 12×8 region. Color fidelity uses OKLab with a 0.025 tolerance and 4px matching radius for foreground and background pixels. Region category denominators have a 3% area floor. Global and local losses are retained in JSON. Raw pixel ratio is secondary. Unreachable entries remain coverage gaps.</p>${table}<main>${cards}</main></html>`)
process.stdout.write(`Report ${path.join(out,"report.html")}\n`)
if(results.some(entry=>entry.passed===false))process.exitCode=1

import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import vm from "node:vm"
import sharp from "sharp"
import {compile} from "@tailwindcss/node"
import {chromium} from "playwright"
import {compareDesign,metricVersion} from "./metric.mjs"
const args=process.argv.slice(2),baseline=args[0],out=args[1]??path.join(os.homedir(),"tmp/airdesign-polish/parity/calibration")
if(!baseline)throw new Error("usage: node bench/design-parity/calibrate.mjs BASELINE OUT")
await fs.mkdir(out,{recursive:true})
const editorOnly=args.includes("--editor-only"),referencesOnly=args.includes("--references-only")
const entries=JSON.parse(await fs.readFile("bench/design-parity/scenarios.json","utf8")),results=editorOnly ? JSON.parse(await fs.readFile(path.join(out,"calibration.json"),"utf8")).results : []
const summary=({score,globalScore,colorLoss,localLoss,worstRegion,ratio,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss})=>({score,globalScore,colorLoss,localLoss,worstRegion,ratio,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss})
for(const entry of editorOnly ? [] : entries){
  const design=await fs.readFile(entry.design),meta=await sharp(design).metadata()
  const shifted=await sharp(design).extract({left:0,top:0,width:meta.width-1,height:meta.height-1}).extend({left:1,top:1,right:0,bottom:0,background:"#ffffff"}).blur(0.3).png().toBuffer()
  const reference=summary(await compareDesign(design,shifted))
  let measured
  if(!referencesOnly&&entry.status==="reachable")measured=summary(await compareDesign(design,await fs.readFile(path.join(baseline,entry.code,"capture.png"))))
  results.push({code:entry.code,surface:entry.surface,reference,measured})
  process.stdout.write(`${entry.code} reference=${reference.score} baseline=${measured?.score}\n`)
}
await fs.writeFile(path.join(out,"calibration.json"),JSON.stringify({metric:metricVersion,results,editor:[]},null,2)+"\n")
const generated=new Map(),copy=await fs.readFile("docs/design/v0.1/copy-kit.json","utf8")
const source=(await fs.readFile("docs/design/v0.1/source/gen-editor.mjs","utf8")).replace("import fs from 'node:fs';","").split("\nfs.writeFileSync('/tmp/strat/ed/ed2.jsx'")[0]
vm.runInNewContext(source,{fs:{readFileSync:()=>copy,writeFileSync:(name,value)=>generated.set(path.basename(name),value)}})
let tokens="--ad-font:Geist;--ad-ink:#222222;--ad-surface:#ffffff;--ad-brand:#4D94FB;--ad-brand-strong:#2D6FCD;--paper-button-top:#93B8EF;--paper-blue-link:#2D6FCD;--deck-navy:#0F2433;--deck-mist:#A9C4D2;--deck-teal:#1D6B8F;"
for(const [key,value] of Object.entries({50:"F5F5F2",100:"F5F5F2",200:"EAEAE7",300:"D7D7D6",400:"A8A8A6",500:"909090",600:"666666",700:"444444",900:"222222",950:"111111"}))tokens+=`--paper-gray-${key}:#${value};`
let fonts=""
for(const weight of [400,600])fonts+=`@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff2;base64,${(await fs.readFile(`packages/ui/fonts/geist-latin-${weight}.woff2`)).toString("base64")})}`
const browser=await chromium.launch({headless:true}),editor=[]
try{
  for(const [file,code] of [["ed3.jsx","S41.01"],["ed1.jsx","S42.01"]]){
    const jsx=generated.get(file),candidates=[...jsx.matchAll(/className="([^"]*)"/g)].flatMap(match=>match[1].split(/\s+/))
    const dependencies=new Set()
    const compiled=await compile('@import "tailwindcss";',{base:process.cwd(),onDependency:file=>dependencies.add(file)})
    const css=compiled.build(candidates)
    const html=jsx.replaceAll("className=","class=").replaceAll("strokeWidth=","stroke-width=").replaceAll("strokeLinecap=","stroke-linecap=").replaceAll("strokeLinejoin=","stroke-linejoin=")
    const context=await browser.newContext({viewport:{width:1470,height:923},deviceScaleFactor:1,locale:"en-US",timezoneId:"UTC",colorScheme:"light",reducedMotion:"reduce"})
    try{
      const page=await context.newPage()
      await page.setContent(`<style>${css} ${fonts} :root{${tokens}}body{margin:0}</style>${html}`)
      await page.evaluate(()=>document.fonts.ready)
      const capture=await page.screenshot({animations:"disabled"})
      await fs.writeFile(path.join(out,`${code}-source.png`),capture)
      await fs.writeFile(path.join(out,`${code}-source.html`),`<style>${css} ${fonts} :root{${tokens}}body{margin:0}</style>${html}`)
      const design=await fs.readFile(entries.find(entry=>entry.code===code).design)
      editor.push({code,file,...summary(await compareDesign(design,capture))})
    }finally{await context.close()}
  }
}finally{await browser.close()}
const targets=Object.fromEntries(["site","studio"].map(surface=>{
  const faithful=[...results.filter(row=>row.surface===surface).map(row=>row.reference.score),...(surface==="studio" ? editor.map(row=>row.score) : [])]
  return [surface,(Math.ceil(Math.max(...faithful)*100)+1)/100]
}))
const report={metric:metricVersion,targets,results,editor}
await fs.writeFile(path.join(out,"calibration.json"),JSON.stringify(report,null,2)+"\n")
process.stdout.write(JSON.stringify({editor,maximumShift:Math.max(...results.map(row=>row.reference.score))})+"\n")

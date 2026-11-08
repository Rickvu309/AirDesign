import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import vm from "node:vm"
import {createHash} from "node:crypto"
import {compile} from "@tailwindcss/node"
import {chromium} from "playwright"
import {compareDesign,metricVersion} from "./metric.mjs"
import {fixedMargin,sourceTarget,validateSourceFloor} from "./source-floor.mjs"
const args=process.argv.slice(2),out=args[1]??path.join(os.homedir(),"tmp/airdesign-polish/parity/calibration")
if(!args[0])throw new Error("usage: node bench/design-parity/calibrate.mjs UNUSED OUT --references-only")
await fs.mkdir(out,{recursive:true})
const entries=JSON.parse(await fs.readFile("bench/design-parity/scenarios.json","utf8"))
const generated=new Map(),copy=await fs.readFile("docs/design/v0.1/copy-kit.json","utf8")
const generatorPath="docs/design/v0.1/source/gen-editor.mjs",generator=await fs.readFile(generatorPath,"utf8")
const source=generator.replace("import fs from 'node:fs';","").split("const LINES = fs.readFileSync")[0]
vm.runInNewContext(source,{fs:{readFileSync:()=>copy,writeFileSync:(name,value)=>generated.set(path.basename(name),value)}})
const digest=value=>createHash("sha256").update(value).digest("hex")
const outputs=[...generated].map(([file,jsx])=>({file,label:jsx.match(/data-node-label="([^"]+)"/)?.[1],jsx}))
await fs.writeFile(path.join(out,"source-inventory.json"),JSON.stringify({generatorPath,generatorSha256:digest(generator),copySha256:digest(copy),cutoff:"const LINES = fs.readFileSync",unavailableAssets:["lines.svg.txt","lines_cover.svg.txt","art/p*.txt","art/grid.txt","art/fin.txt"],outputs:outputs.map(({file,label})=>({file,label})),partialBlueprintSources:["billing_components.py","settings_usage_modules.py","settings_agents_account_modules.py"],externalCanvasEdits:["fixsel.py","landing-post.sh"]},null,2)+"\n")
let tokens="--ad-font:Geist;--ad-ink:#222222;--ad-surface:#ffffff;--ad-brand:#4D94FB;--ad-brand-strong:#2D6FCD;--paper-button-top:#93B8EF;--paper-blue-link:#2D6FCD;--deck-navy:#0F2433;--deck-mist:#A9C4D2;--deck-teal:#1D6B8F;"
for(const [key,value] of Object.entries({50:"F5F5F2",100:"F5F5F2",200:"EAEAE7",300:"D7D7D6",400:"A8A8A6",500:"909090",600:"666666",700:"444444",900:"222222",950:"111111"}))tokens+=`--paper-gray-${key}:#${value};`
let fonts=""
for(const weight of [400,600])fonts+=`@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff2;base64,${(await fs.readFile(`packages/ui/fonts/geist-latin-${weight}.woff2`)).toString("base64")})}`
const browser=await chromium.launch({headless:true}),results=[]
try{
  for(const entry of entries){
    const matches=outputs.filter(row=>row.label?.startsWith(entry.code+" "))
    const selected=entry.code==="S12.01" ? outputs.find(row=>row.file==="ed21.jsx"&&row.label==="S01.02 Pricing, free usage") : matches.at(-1)
    if(!selected){
      results.push({code:entry.code,surface:entry.surface,status:"uncalibrated",floor:null,target:null,reason:"no complete Chromium-renderable source with exact scenario label; partial blueprint or external canvas records cannot supply a screen floor"})
      continue
    }
    const {file,jsx,label}=selected,candidates=[...jsx.matchAll(/className="([^"]*)"/g)].flatMap(match=>match[1].split(/\s+/))
    const compiled=await compile('@import "tailwindcss";',{base:process.cwd(),onDependency:()=>{}})
    const html=jsx.replaceAll("className=","class=").replaceAll("strokeWidth=","stroke-width=").replaceAll("strokeLinecap=","stroke-linecap=").replaceAll("strokeLinejoin=","stroke-linejoin=")
    const content=`<style>${compiled.build(candidates)} ${fonts} :root{${tokens}}body{margin:0}</style>${html}`
    const context=await browser.newContext({viewport:entry.viewport,deviceScaleFactor:1,locale:"en-US",timezoneId:"UTC",colorScheme:"light",reducedMotion:"reduce"})
    try{
      const page=await context.newPage(),errors=[]
      page.on("pageerror",error=>errors.push(String(error)))
      page.on("requestfailed",request=>errors.push(request.url()))
      const captures=[]
      for(let repeat=0;repeat<2;repeat++){
        await page.setContent(content)
        await page.evaluate(async()=>{await Promise.all([document.fonts.load("400 14px Geist"),document.fonts.load("600 14px Geist")]);await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode()))})
        captures.push(await page.screenshot({animations:"disabled",caret:"hide",fullPage:entry.code==="S11.01"}))
      }
      if(errors.length||!captures[0].equals(captures[1]))throw new Error(`non-reproducible-source:${entry.code}:${errors}`)
      const design=await fs.readFile(entry.design),metric=await compareDesign(design,captures[0])
      const {score,globalScore,localLoss,worstRegion,colorLoss,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss}=metric
      const row={code:entry.code,surface:entry.surface,status:"calibrated",file,label,mapping:entry.code==="S12.01" ? "legacy S01.02 Pricing, free usage → S12.01 Discover / Pricing / Default" : "exact-root-scenario-label",viewport:entry.viewport,sourceSha256:digest(jsx),htmlSha256:digest(content),designSha256:digest(design),captureSha256:digest(captures[0]),repeatSha256:digest(captures[1]),repeatIdentical:true,floor:score,target:sourceTarget(score),globalScore,localLoss,worstRegion,colorLoss,foregroundLoss,edgeLoss,sizeLoss,backgroundLoss}
      validateSourceFloor(row)
      results.push(row)
      await fs.writeFile(path.join(out,`${entry.code}-source.png`),captures[0])
      await fs.writeFile(path.join(out,`${entry.code}-repeat.png`),captures[1])
      await fs.writeFile(path.join(out,`${entry.code}-source.html`),content)
      process.stdout.write(`${entry.code} ${file} floor=${score} target=${row.target} identical=true\n`)
    }finally{await context.close()}
  }
}finally{await browser.close()}
await fs.writeFile(path.join(out,"calibration.json"),JSON.stringify({metric:metricVersion,fixedMargin,browserVersion:browser.version(),generatorSha256:digest(generator),results},null,2)+"\n")
process.stdout.write(JSON.stringify({calibrated:results.filter(row=>row.status==="calibrated").length,uncalibrated:results.filter(row=>row.status==="uncalibrated").length})+"\n")

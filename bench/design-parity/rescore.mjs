import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import {createHash} from "node:crypto"
import {compareDesign} from "./metric.mjs"
import {compareComponent} from "./component-metric.mjs"
import {sourceVerdict} from "./source-floor.mjs"
const [out,...reports]=process.argv.slice(2)
if(!out||!reports.length)throw new Error("usage: node bench/design-parity/rescore.mjs CALIBRATION_OUT REPORT...")
const calibration=JSON.parse(await fs.readFile(path.join(out,"calibration.json"),"utf8")),results=[]
const digest=value=>createHash("sha256").update(value).digest("hex")
await fs.mkdir(path.join(out,"comparisons"),{recursive:true})
for(const reportPath of reports){
  const report=JSON.parse(await fs.readFile(reportPath,"utf8"))
  for(const old of report.results){
    const floor=calibration.results.find(row=>row.code===old.code)
    if(!floor)throw new Error(`missing-floor:${old.code}`)
    const capturePath=path.join(path.dirname(reportPath),old.artifacts?.capture??`${old.code}/capture.png`)
    let capture
    try{capture=await fs.readFile(capturePath)}catch(error){if(error.code!=="ENOENT")throw error;results.push({head:report.head,code:old.code,reportPath,capturePath,status:"missing-capture",oldPassed:old.passed??null,sourceStatus:floor.status});continue}
    const design=await fs.readFile(old.design),metric=await compareDesign(design,capture)
    let component
    if(old.component){
      const box=old.componentResult?.box
      if(box){const compared=await compareComponent(design,capture,old.component.designBox,box);component={score:compared.metric.score,oldScore:old.componentResult.score,target:old.component.target,passed:compared.metric.score<=old.component.target,comparison:compared.metric.comparison,sizeLoss:compared.metric.sizeLoss}}
      else component={passed:false,reason:"missing retained component box"}
    }
    const verdict=sourceVerdict(floor,metric.score),sourcePassed=verdict==="uncalibrated" ? null : verdict==="pass"
    const independentPassed=old.status==="reachable"&&old.structurePassed===true&&(!component||component.passed)&&metric.score<=old.budget
    const newPassed=independentPassed ? sourcePassed : false
    const directory=path.join(out,"comparisons",`${report.head.slice(0,8)}-${old.code}`)
    await fs.mkdir(directory,{recursive:true})
    let sideBySide=null
    if(floor.file){
      const source=await fs.readFile(path.join(out,`${old.code}-source.png`)),images=[design,source,capture]
      const sizes=await Promise.all(images.map(image=>sharp(image).metadata())),width=Math.max(...sizes.map(size=>size.width)),height=Math.max(...sizes.map(size=>size.height))
      sideBySide=path.join(directory,"design-source-product.png")
      await sharp({create:{width:width*3,height,channels:4,background:"white"}}).composite(images.map((input,index)=>({input,left:index*width,top:0}))).png().toFile(sideBySide)
    }
    results.push({head:report.head,code:old.code,reportPath,capturePath,captureSha256:digest(capture),sourceStatus:floor.status,sourceReason:floor.reason??null,measuredSourceScore:floor.measuredFloor??floor.floor,sourceFloor:floor.floor,target:floor.target,oldTarget:old.target,oldScore:old.score,score:metric.score,oldScreenPassed:Number.isFinite(old.score) ? old.score<=old.target : null,newScreenPassed:sourcePassed,oldPassed:old.passed??null,newPassed,independentPassed,component,sourceProductGap:floor.status==="calibrated" ? metric.score-floor.floor : null,marginCrossesProduct:floor.status==="calibrated"&&metric.score>floor.floor&&metric.score<=floor.target,weakSeparation:floor.status==="calibrated"&&metric.score-floor.floor<=0.02,sideBySide})
  }
}
const heads=[...new Set(results.map(row=>row.head))]
const counts=heads.map(head=>{const rows=results.filter(row=>row.head===head&&row.status!=="missing-capture");return {head,captures:rows.length,oldScreenPass:rows.filter(row=>row.oldScreenPassed===true).length,newScreenPass:rows.filter(row=>row.newScreenPassed===true).length,uncalibrated:rows.filter(row=>row.newScreenPassed===null).length,oldStrictPass:rows.filter(row=>row.oldPassed===true).length,newStrictPass:rows.filter(row=>row.newPassed===true).length,strictUncalibrated:rows.filter(row=>row.newPassed===null).length,weakSeparation:rows.filter(row=>row.weakSeparation).map(row=>row.code),marginCrossings:rows.filter(row=>row.marginCrossesProduct).map(row=>row.code)}})
await fs.writeFile(path.join(out,"rescore.json"),JSON.stringify({calibrationSha256:digest(await fs.readFile(path.join(out,"calibration.json"))),columns:["authoritative design","Chromium source","retained product"],counts,results},null,2)+"\n")
process.stdout.write(JSON.stringify(counts)+"\n")

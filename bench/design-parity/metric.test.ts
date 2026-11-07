import {readFile} from "node:fs/promises"
import sharp from "sharp"
import {expect,it} from "vitest"
import {surfaceTargets} from "./targets.ts"
import {compareDesign} from "./metric.mjs"
const fixture=(name:string)=>readFile(new URL(`./fixtures/${name}.png`,import.meta.url))
it("rejects the real Recents layout drift that the frame ratio hides",async()=>{
  const result=await compareDesign(await fixture("recents-design"),await fixture("recents-capture"))
  expect(result.ratio).toBeLessThan(0.1)
  expect(result.score).toBeGreaterThan(0.6)
})
it("accepts faithful shifted and antialiased references and identical designs",async()=>{
  const design=await fixture("recents-design")
  expect((await compareDesign(design,design)).score).toBe(0)
  expect((await compareDesign(design,await fixture("recents-shift"))).score).toBeLessThan(surfaceTargets.studio)
})
it("does not let a dim dialog overlay hide layout drift",async()=>{
  expect((await compareDesign(await fixture("dialog-design"),await fixture("dialog-capture"))).score).toBeGreaterThan(0.5)
})
it("scores full-page dimension mismatches instead of skipping them",async()=>{
  const design=await fixture("recents-design"),metadata=await sharp(design).metadata()
  const short=await sharp(design).extract({left:0,top:0,width:metadata.width!,height:100}).png().toBuffer()
  const result=await compareDesign(design,short)
  expect(result.score).toBeGreaterThan(0.6)
  expect(result.sizeLoss).toBeGreaterThan(0.6)
})
it("rejects a wrong flat background even when neither image has edges",async()=>{
  const solid=(background:string)=>sharp({create:{width:80,height:60,channels:4,background}}).png().toBuffer()
  const result=await compareDesign(await solid("#ffffff"),await solid("#000000"))
  expect(result.score).toBeGreaterThan(0.9)
})

it("rejects pink-shift and missing-heading adversarial fixtures with local perceptual fidelity",async()=>{
  const design=await readFile("docs/design/v0.1/screens/S31.02-decks-browse-recents-grid.png")
  for(const name of ["recents-pink","recents-heading-removed"]){
    const result=await compareDesign(design,await fixture(name))
    expect(result.score).toBeGreaterThan(surfaceTargets.studio)
    expect(result.localLoss).toBeGreaterThan(surfaceTargets.studio)
  }
})

it("rejects a wrong primary button color without diluting it into the frame",async()=>{
  const design=await readFile("docs/design/v0.1/screens/S31.02-decks-browse-recents-grid.png")
  const {data,info}=await sharp(design).removeAlpha().raw().toBuffer({resolveWithObject:true})
  for(let y=40;y<80;y++)for(let x=1222;x<1342;x++){
    const offset=(y*info.width+x)*info.channels,red=data[offset]!,green=data[offset+1]!,blue=data[offset+2]!
    if(blue>red+20){data[offset]=blue;data[offset+1]=Math.floor(green/2);data[offset+2]=Math.floor(red/2)}
  }
  const wrong=await sharp(data,{raw:{width:info.width,height:info.height,channels:3}}).png().toBuffer()
  const result=await compareDesign(design,wrong)
  expect(result.globalScore).toBeLessThan(surfaceTargets.studio)
  expect(result.localLoss).toBeGreaterThan(surfaceTargets.studio)
})

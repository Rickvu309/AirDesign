import {readFile} from "node:fs/promises"
import sharp from "sharp"
import {expect,it} from "vitest"
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
  expect((await compareDesign(design,await fixture("recents-shift"))).score).toBeLessThan(0.08)
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

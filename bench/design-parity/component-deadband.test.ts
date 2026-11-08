import sharp from "sharp"
import {expect,it} from "vitest"
import {compareComponent} from "./component-metric.mjs"
it("accepts a pure 3px crop while retaining original dimensions and rejects changed common content",async()=>{
  const box={left:0,top:0,width:400,height:208}
  const design=await sharp({create:{width:400,height:208,channels:4,background:"white"}}).composite([{input:await sharp({create:{width:180,height:60,channels:4,background:"#4D94FB"}}).png().toBuffer(),left:30,top:40}]).png().toBuffer()
  const crop=await sharp(design).extract({...box,height:205}).png().toBuffer()
  const result=await compareComponent(design,crop,box,{...box,height:205})
  expect(result.metric.score).toBe(0)
  expect(result.metric.sizeLoss).toBe(0)
  expect(result.metric.comparison).toMatchObject({design:{width:400,height:208},capture:{width:400,height:205},commonArea:true})
  const changed=await sharp(crop).composite([{input:await sharp({create:{width:180,height:60,channels:4,background:"#ff0055"}}).png().toBuffer(),left:30,top:40}]).png().toBuffer()
  expect((await compareComponent(design,changed,box,{...box,height:205})).metric.score).toBeGreaterThan(0.5)
  const large=await sharp(design).extract({...box,height:190}).png().toBuffer()
  const mismatch=await compareComponent(design,large,box,{...box,height:190})
  expect(mismatch.metric.sizeLoss).toBeGreaterThan(0.01)
  expect(mismatch.metric.score).toBeGreaterThan(0.01)
  expect(mismatch.metric.comparison.commonArea).toBe(false)
})

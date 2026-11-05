import { imageJob,readImageJob } from "../src/assets/image-job.ts"
import { expect,it } from "vitest"
import sharp from "sharp"
import { createHash } from "node:crypto"
import { validateImage,readValidatedImage,readValidatedAsset,serializeValidatedImage } from "../src/assets/validate.ts"
import { assetProviders } from "../src/assets/providers.ts"
import { isImagePlacement } from "../../deck/src/index.ts"
import { fixtureDeck } from "../../deck/src/fixture.ts"
import { id } from "../../deck/src/index.ts"
import { writeSavedPptx } from "../../pptx/src/export-deck.ts"
import { createNativePresentation } from "../../pptx/src/native.ts"
import { importPptx } from "../../pptx/src/index.ts"
import { importedDeck } from "../../pptx/src/import-deck.ts"
import { readArchive,writeArchive } from "../../pptx/src/archive.ts"

it("retains original bytes while orienting, bounding and stripping photo metadata",async()=>{
  const bytes=await sharp({create:{width:4800,height:1200,channels:3,background:"blue"}}).jpeg().withMetadata({orientation:6}).toBuffer()
  const image=await validateImage(bytes),normalized=await sharp(Buffer.from(image.normalized,"base64")).metadata()
  expect(Buffer.from(image.original,"base64")).toEqual(bytes)
  expect(image.hash).toBe(createHash("sha256").update(bytes).digest("hex"))
  expect([image.width,image.height]).toEqual([1024,4096])
  expect(normalized.orientation).toBeUndefined()
  expect(readValidatedImage(Buffer.from(JSON.stringify(image)))).toEqual(image)
  expect(()=>readValidatedImage(Buffer.from(JSON.stringify({...image,original:"forged"})))).toThrow("invalid-image-validation-result")
})

it.each(['<script>alert(1)</script>','<image href="https://example.com/a.png"/>','<use href="file:///etc/passwd"/>','<rect onclick="alert(1)"/>'])('refuses active or remote SVG before decoding: %s',async content=>{
  await expect(validateImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${content}</svg>`))).rejects.toThrow()
})

it("bundles licensed stock and MIT icons behind the same safe provider seam",async()=>{
  for(const provider of assetProviders){
    expect(provider.search("impossible-query-01234")).toEqual([])
    for(const item of provider.search("")){
      const source=await provider.read(item.id),image=await validateImage(source.bytes)
      expect(image.width).toBeGreaterThan(0)
      expect(source.provenance).toEqual(item.provenance)
      expect(source.provenance.license.length).toBeGreaterThan(0)
    }
    await expect(provider.read("../../private")).rejects.toThrow("provider-item-not-found")
  }
})

it("exports full-resolution native pictures with independent crop, ellipse mask and alt text",async()=>{
  const image=await validateImage(await sharp({create:{width:640,height:320,channels:3,background:"green"}}).png().toBuffer()),deck=fixtureDeck(1),slide=deck.slides[0]!
  const placement={asset:image.hash,crop:{x:.1,y:.2,width:.7,height:.6},focal:{x:.45,y:.5},mask:"ellipse" as const,alt:"Revenue by region & year"}
  expect(isImagePlacement(placement)).toBe(true)
  expect(isImagePlacement({...placement,crop:{...placement.crop,x:.9}})).toBe(false)
  slide.elements=[{id:id("picture"),kind:"image",image:placement,box:{x:40,y:50,width:400,height:200},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null}]
  const parts=await readArchive(await writeSavedPptx(deck,0,null,{}, {[image.hash]:"data:image/png;base64,"+image.normalized})),xml=parts.get("ppt/slides/slide1.xml")!.toString()
  expect(xml).toContain("<p:pic>")
  expect(xml).toContain('l="10000" t="20000" r="20000" b="20000"')
  expect(xml).toContain('prst="ellipse"')
  expect(xml).toContain('descr="Revenue by region &amp; year"')
  const media=[...parts].filter(([name])=>name.startsWith("ppt/media/")&&name.endsWith(".png"))
  expect(media.length).toBeGreaterThan(0)
  expect(await sharp(media[0]![1]).metadata()).toMatchObject({width:640,height:320})
})

it("adds a native picture to an imported slide while preserving original objects",async()=>{
  const presentation=await createNativePresentation([{title:"Preserved title",table:{headers:["A"],rows:[["Preserved body"]]},chart:{name:"Sales",labels:["A"],values:[1]},notes:""}]),source=await writeArchive(presentation.parts),deck=importedDeck(presentation),image=await validateImage(await sharp({create:{width:60,height:30,channels:3,background:"red"}}).png().toBuffer())
  deck.slides[0]!.elements.push({id:id("addedPicture"),kind:"image",image:{asset:image.hash,crop:{x:0,y:0,width:1,height:1},focal:{x:.5,y:.5},mask:"rectangle",alt:"Added image"},box:{x:5,y:5,width:60,height:30},source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null})
  const output=await writeSavedPptx(deck,1,source,{}, {[image.hash]:"data:image/png;base64,"+image.normalized}),parts=await readArchive(output),xml=parts.get("ppt/slides/slide1.xml")!.toString()
  expect(xml).toContain("Preserved title")
  expect(xml).toContain("Preserved body")
  expect(xml).toContain('descr="Added image"')
  expect((await importPptx(output)).report.relationships.some(rel=>rel.part==="ppt/slides/slide1.xml" && rel.type.endsWith("/image"))).toBe(true)
})

it("stores shared validated representations once and bounds binary artifact references",async()=>{
  const input=await sharp({create:{width:640,height:320,channels:3,background:"blue"}}).png().toBuffer(),image=await validateImage(input),provenance=assetProviders[0]!.search("")[0]!.provenance
  const artifact=serializeValidatedImage(image,provenance)
  expect(readValidatedAsset(artifact)).toEqual({image,provenance})
  expect(readValidatedImage(artifact)).toEqual(image)
  expect(artifact.length).toBeLessThan(Buffer.byteLength(JSON.stringify(image)))
  expect(()=>readValidatedImage(artifact.subarray(0,artifact.length-1))).toThrow("invalid-image-validation-result")
  const corrupt=Buffer.from(artifact);corrupt.writeUInt32BE(65537,4)
  expect(()=>readValidatedImage(corrupt)).toThrow("invalid-image-validation-result")
})

it("passes binary image jobs without base64 expansion and validates their boundary",async()=>{
  const bytes=await sharp({create:{width:20,height:10,channels:3,background:"red"}}).png().toBuffer(),provenance=assetProviders[0]!.search("")[0]!.provenance
  const job=imageJob(bytes,provenance)
  expect(readImageJob(job)).toEqual({bytes,provenance})
  expect(job.length).toBe(bytes.length+Buffer.byteLength(JSON.stringify(provenance))+8)
  expect(()=>readImageJob(job.subarray(0,7))).toThrow("invalid-image-job")
  const invalid=Buffer.from(job);invalid.writeUInt32BE(65537,4)
  expect(()=>readImageJob(invalid)).toThrow("invalid-image-job")
})

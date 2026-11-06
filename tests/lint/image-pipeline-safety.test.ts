import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {imagePipelineSafetyHits} from "../../scripts/lint/image-pipeline-safety.ts"
it("rejects full blob reads for thumbnails and metadata",()=>{
  const file="apps/server/src/images/store.ts"
  expect(imagePipelineSafetyHits(file,'tx.query("SELECT * FROM image_asset WHERE owner=$1 AND hash=$2")')).toEqual([{line:1,reason:"image-query-must-select-only-needed-columns"}])
  expect(imagePipelineSafetyHits(file,readFileSync(file,"utf8"))).toEqual([])
})
it("rejects the default PNG compression cost in the isolated validator",()=>{
  const file="packages/files/src/assets/validate.ts",source=readFileSync(file,"utf8")
  expect(imagePipelineSafetyHits(file,source.replace(/\.png\(\{compressionLevel:\d+\}\)/g,".png()"))).toHaveLength(3)
  expect(imagePipelineSafetyHits(file,source)).toEqual([])
})

it("rejects decoding the normalized image again for a thumbnail",()=>{
  expect(imagePipelineSafetyHits("packages/files/src/assets/validate.ts","sharp(data).resize(512)")).toMatchObject([{reason:"image-thumbnail-must-use-decoded-raster"}])
  expect(imagePipelineSafetyHits("packages/files/src/assets/validate.ts","sharp(pixels,{raw:info}).resize(512)")).toEqual([])
})
it("keeps operation metadata queries off payload blobs",()=>{
  expect(imagePipelineSafetyHits("packages/operations/src/index.ts",'db.prepare("SELECT * FROM operations WHERE id=?")')).toMatchObject([{reason:"image-query-must-select-only-needed-columns"}])
  expect(imagePipelineSafetyHits("packages/operations/src/index.ts",readFileSync("packages/operations/src/index.ts","utf8"))).toEqual([])
})

it("indexes operation expiration without scanning image payloads",()=>{
  const file="packages/operations/src/index.ts",source=readFileSync(file,"utf8")
  expect(imagePipelineSafetyHits(file,source.replace(" CREATE INDEX IF NOT EXISTS operations_expiry ON operations(state,expires);",""))).toEqual([{line:1,reason:"operation-expiry-must-use-metadata-index"}])
  expect(imagePipelineSafetyHits(file,source)).toEqual([])
})

it("checks native exported pictures through their slide relationship rather than a PNG suffix",()=>{
  const file="bench/templates-images/live.mjs"
  expect(imagePipelineSafetyHits(file,'parts.find(([name])=>name.startsWith("ppt/media/")&&name.endsWith(".png"))')).toEqual([{line:1,reason:"native-picture-probe-must-follow-relationship"}])
  expect(imagePipelineSafetyHits(file,readFileSync(file,"utf8"))).toEqual([])
})

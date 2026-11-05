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
  expect(imagePipelineSafetyHits(file,source.replaceAll(".png({compressionLevel:1})",".png()"))).toHaveLength(2)
  expect(imagePipelineSafetyHits(file,source)).toEqual([])
})

import sharp from "sharp"
import { readFile,writeFile } from "node:fs/promises"
import { readImageJob } from "../../../packages/files/src/assets/image-job.ts"
import { validateImage,serializeValidatedImage } from "../../../packages/files/src/assets/validate.ts"
sharp.concurrency(1)
sharp.cache(false)
try {
  const {bytes,provenance}=readImageJob(await readFile("/job/input.pptx"))
  const result=await validateImage(bytes)
  await writeFile("/job/result.pptx",serializeValidatedImage(result,provenance))
  await writeFile("/job/report.json",JSON.stringify({hash:result.hash,width:result.width,height:result.height,mime:result.mime,bytes:result.bytes,validator:"P03-isolated-image"}))
}catch(error){await writeFile("/job/failure.json",JSON.stringify({code:error instanceof Error ? error.message.slice(0,200) : "invalid-image"}));process.exitCode=1}

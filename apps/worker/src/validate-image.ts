import { readFile,writeFile } from "node:fs/promises"
import { parseProvenance } from "../../../packages/files/src/assets/provenance.ts"
import { validateImage } from "../../../packages/files/src/assets/validate.ts"
try {
  const input:unknown=JSON.parse(await readFile("/job/input.pptx","utf8"))
  if(!input || typeof input!=="object" || !("base64" in input) || typeof input.base64!=="string" || !("provenance" in input))throw new Error("invalid-image-job")
  const provenance=parseProvenance(input.provenance)
  const result=await validateImage(Buffer.from(input.base64,"base64"))
  await writeFile("/job/result.pptx",JSON.stringify({...result,provenance}))
  await writeFile("/job/report.json",JSON.stringify({hash:result.hash,width:result.width,height:result.height,mime:result.mime,bytes:result.bytes,validator:"P03-isolated-image"}))
}catch(error){await writeFile("/job/failure.json",JSON.stringify({code:error instanceof Error ? error.message.slice(0,200) : "invalid-image"}));process.exitCode=1}

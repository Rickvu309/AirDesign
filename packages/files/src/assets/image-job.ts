import { parseProvenance,type AssetProvenance } from "./provenance.ts"

export function imageJob(bytes:Buffer,provenance:AssetProvenance):Buffer {
  const metadata=Buffer.from(JSON.stringify(provenance)),prefix=Buffer.alloc(8)
  prefix.write("ADI0");prefix.writeUInt32BE(metadata.length,4)
  return Buffer.concat([prefix,metadata,bytes])
}
export function readImageJob(input:Buffer):{bytes:Buffer;provenance:AssetProvenance} {
  if(input.length<8 || input.subarray(0,4).toString()!=="ADI0")throw new Error("invalid-image-job")
  const length=input.readUInt32BE(4),start=8+length
  if(length>65536 || start>=input.length)throw new Error("invalid-image-job")
  return {bytes:input.subarray(start),provenance:parseProvenance(JSON.parse(input.subarray(8,start).toString()))}
}

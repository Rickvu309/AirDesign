import sharp from "sharp"
import { createHash } from "node:crypto"
import { parseProvenance,type AssetProvenance } from "./provenance.ts"
import { rejectActiveSvg } from "../index.ts"

export const assetLimits={bytes:20*1024*1024,pixels:80_000_000,edge:4096,quota:512*1024*1024} as const
export type ValidatedImage={original:string;exportImage:string;exportMime:"image/png"|"image/jpeg";normalized:string;thumbnail:string;hash:string;mime:"image/png"|"image/jpeg"|"image/webp"|"image/svg+xml";width:number;height:number;originalWidth:number;originalHeight:number;bytes:number}
export async function validateImage(input:Buffer):Promise<ValidatedImage> {
  if(input.length===0 || input.length>assetLimits.bytes)throw new Error("image-size-limit")
  const svg=/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(input.subarray(0,1024).toString())
  if(svg)rejectActiveSvg(input.toString("utf8"))
  const decoder=sharp(input,{limitInputPixels:assetLimits.pixels,sequentialRead:true,failOn:"warning"}),metadata=await decoder.metadata()
  const mime=metadata.format==="png" ? "image/png" : metadata.format==="jpeg" ? "image/jpeg" : metadata.format==="webp" ? "image/webp" : metadata.format==="svg" && svg ? "image/svg+xml" : null
  if(!mime || !metadata.width || !metadata.height || (metadata.pages ?? 1)>1)throw new Error("unsupported-image")
  const oriented=()=>decoder.clone().autoOrient()
  const exportMime=mime==="image/jpeg" ? "image/jpeg" : "image/png"
  const reusable=(mime==="image/png" || mime==="image/jpeg") && (metadata.orientation===undefined || metadata.orientation===1)
  const full=await (reusable ? Promise.resolve(input) : exportMime==="image/jpeg" ? oriented().jpeg({quality:95,optimiseCoding:false}).toBuffer() : oriented().png({compressionLevel:0}).toBuffer())
  const preview=await (exportMime==="image/png" && !metadata.exif && !metadata.icc && !metadata.iptc && !metadata.xmp && metadata.width<=assetLimits.edge && metadata.height<=assetLimits.edge ? Promise.resolve({data:full,info:{width:metadata.width,height:metadata.height}}) : oriented().resize({width:assetLimits.edge,height:assetLimits.edge,fit:"inside",withoutEnlargement:true}).png({compressionLevel:0}).toBuffer({resolveWithObject:true}))
  const thumbnail=await oriented().resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).png({compressionLevel:0}).toBuffer()
  return {original:input.toString("base64"),exportImage:full.toString("base64"),exportMime,normalized:preview.data.toString("base64"),thumbnail:thumbnail.toString("base64"),hash:createHash("sha256").update(input).digest("hex"),mime,width:preview.info.width,height:preview.info.height,originalWidth:metadata.width,originalHeight:metadata.height,bytes:input.length}
}
const imageRepresentations=["original","normalized","thumbnail","exportImage"] as const
export function serializeValidatedImage(image:ValidatedImage,provenance:AssetProvenance):Buffer {
  const buffers:Buffer[]=[],seen=new Map<string,{offset:number;length:number}>()
  let offset=0
  const references=Object.fromEntries(imageRepresentations.map(key=>{
    const encoded=image[key],previous=seen.get(encoded)
    if(previous)return [key,previous]
    const buffer=Buffer.from(encoded,"base64"),reference={offset,length:buffer.length}
    buffers.push(buffer);seen.set(encoded,reference);offset+=buffer.length
    return [key,reference]
  }))
  const metadata=Buffer.from(JSON.stringify({...image,...references,provenance})),prefix=Buffer.alloc(8)
  prefix.write("ADI1");prefix.writeUInt32BE(metadata.length,4)
  return Buffer.concat([prefix,metadata,...buffers])
}
function imageArtifactValue(bytes:Buffer):unknown {
  if(bytes.subarray(0,4).toString()!=="ADI1")return JSON.parse(bytes.toString())
  if(bytes.length<8)throw new Error("invalid-image-validation-result")
  const length=bytes.readUInt32BE(4),start=8+length
  if(length>65536 || start>bytes.length)throw new Error("invalid-image-validation-result")
  const raw:unknown=JSON.parse(bytes.subarray(8,start).toString())
  if(!raw || typeof raw!=="object" || Array.isArray(raw))throw new Error("invalid-image-validation-result")
  const value:Record<string,unknown>=Object.fromEntries(Object.entries(raw))
  const representations=new Map<string,string>()
  for(const key of imageRepresentations){
    const reference=value[key]
    if(!reference || typeof reference!=="object" || !("offset" in reference) || !("length" in reference) || typeof reference.offset!=="number" || typeof reference.length!=="number" || !Number.isSafeInteger(reference.offset) || !Number.isSafeInteger(reference.length) || reference.offset<0 || reference.length<=0 || start+reference.offset+reference.length>bytes.length)throw new Error("invalid-image-validation-result")
    const identity=`${reference.offset}:${reference.length}`,encoded=representations.get(identity) ?? bytes.subarray(start+reference.offset,start+reference.offset+reference.length).toString("base64")
    representations.set(identity,encoded)
    value[key]=encoded
  }
  return value
}
export function readValidatedAsset(bytes:Buffer):{image:ValidatedImage;provenance:AssetProvenance} {
  const value=imageArtifactValue(bytes),image=validatedImageValue(value)
  if(!value || typeof value!=="object" || !("provenance" in value))throw new Error("invalid-image-validation-result")
  return {image,provenance:parseProvenance(value.provenance)}
}
export function readValidatedImage(bytes:Buffer):ValidatedImage {return validatedImageValue(imageArtifactValue(bytes))}
function validatedImageValue(v:unknown):ValidatedImage {
  if(!v || typeof v!=="object" || !("exportImage" in v) || typeof v.exportImage!=="string" || !("exportMime" in v) || !["image/png","image/jpeg"].includes(String(v.exportMime)) || !("original" in v) || typeof v.original!=="string" || !("normalized" in v) || typeof v.normalized!=="string" || !("thumbnail" in v) || typeof v.thumbnail!=="string" || !("hash" in v) || typeof v.hash!=="string" || !("mime" in v) || !["image/png","image/jpeg","image/webp","image/svg+xml"].includes(String(v.mime)) || !("width" in v) || !("height" in v) || !("originalWidth" in v) || !("originalHeight" in v) || !("bytes" in v))throw new Error("invalid-image-validation-result")
  const {width,height,originalWidth,originalHeight,bytes:size}=v,originalBytes=Buffer.from(v.original,"base64")
  if(![width,height,originalWidth,originalHeight,size].every(value=>typeof value==="number"&&Number.isSafeInteger(value)&&value>0)||Number(width)>assetLimits.edge||Number(height)>assetLimits.edge||Number(size)>assetLimits.bytes||originalBytes.length!==size||createHash("sha256").update(originalBytes).digest("hex")!==v.hash)throw new Error("invalid-image-validation-result")
  const {original,normalized,thumbnail,hash,mime,width:previewWidth,height:previewHeight,originalWidth:sourceWidth,originalHeight:sourceHeight,bytes,exportImage,exportMime}=v as ValidatedImage
  return {original,normalized,thumbnail,hash,mime,width:previewWidth,height:previewHeight,originalWidth:sourceWidth,originalHeight:sourceHeight,bytes,exportImage,exportMime}
}

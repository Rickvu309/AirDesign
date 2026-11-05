import sharp from "sharp"
import { createHash } from "node:crypto"
import { rejectActiveSvg } from "../index.ts"

export const assetLimits={bytes:20*1024*1024,pixels:80_000_000,edge:4096,quota:512*1024*1024} as const
export type ValidatedImage={original:string;normalized:string;thumbnail:string;hash:string;mime:"image/png"|"image/jpeg"|"image/webp"|"image/svg+xml";width:number;height:number;originalWidth:number;originalHeight:number;bytes:number}
export async function validateImage(input:Buffer):Promise<ValidatedImage> {
  if(input.length===0 || input.length>assetLimits.bytes)throw new Error("image-size-limit")
  const svg=/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(input.subarray(0,1024).toString())
  if(svg)rejectActiveSvg(input.toString("utf8"))
  const decoder=sharp(input,{limitInputPixels:assetLimits.pixels,failOn:"warning"}),metadata=await decoder.metadata()
  const mime=metadata.format==="png" ? "image/png" : metadata.format==="jpeg" ? "image/jpeg" : metadata.format==="webp" ? "image/webp" : metadata.format==="svg" && svg ? "image/svg+xml" : null
  if(!mime || !metadata.width || !metadata.height || (metadata.pages ?? 1)>1)throw new Error("unsupported-image")
  const {data,info}=await decoder.rotate().resize({width:assetLimits.edge,height:assetLimits.edge,fit:"inside",withoutEnlargement:true}).png({compressionLevel:1}).toBuffer({resolveWithObject:true})
  const thumbnail=await sharp(data).resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).png({compressionLevel:1}).toBuffer()
  return {original:input.toString("base64"),normalized:data.toString("base64"),thumbnail:thumbnail.toString("base64"),hash:createHash("sha256").update(input).digest("hex"),mime,width:info.width,height:info.height,originalWidth:metadata.width,originalHeight:metadata.height,bytes:input.length}
}
export function readValidatedImage(bytes:Buffer):ValidatedImage {
  const v:unknown=JSON.parse(bytes.toString())
  if(!v || typeof v!=="object" || !("original" in v) || typeof v.original!=="string" || !("normalized" in v) || typeof v.normalized!=="string" || !("thumbnail" in v) || typeof v.thumbnail!=="string" || !("hash" in v) || typeof v.hash!=="string" || !("mime" in v) || !["image/png","image/jpeg","image/webp","image/svg+xml"].includes(String(v.mime)) || !("width" in v) || !("height" in v) || !("originalWidth" in v) || !("originalHeight" in v) || !("bytes" in v))throw new Error("invalid-image-validation-result")
  const {width,height,originalWidth,originalHeight,bytes:size}=v
  if(![width,height,originalWidth,originalHeight,size].every(value=>typeof value==="number"&&Number.isSafeInteger(value)&&value>0)||Number(width)>assetLimits.edge||Number(height)>assetLimits.edge||Number(size)>assetLimits.bytes||Buffer.from(v.original,"base64").length!==size||createHash("sha256").update(Buffer.from(v.original,"base64")).digest("hex")!==v.hash)throw new Error("invalid-image-validation-result")
  return v as ValidatedImage
}

export type AssetProvenance = { kind:"upload";source:"Personal upload";license:"User supplied" } | { kind:"stock"|"icon";source:string;license:string;provider:string;item:string;author?:string;licenseUrl?:string }
export type AssetSummary={id:string;mime:string;width:number;height:number;bytes:number;provenance:AssetProvenance;listed:boolean}
export const uploadProvenance:AssetProvenance={kind:"upload",source:"Personal upload",license:"User supplied"}
export function parseProvenance(value:unknown):AssetProvenance {
  if(!value || typeof value!=="object" || !("kind" in value))throw new Error("invalid-asset-provenance")
  if(value.kind==="upload")return uploadProvenance
  const attribution="author" in value ? value.author : undefined,licenseUrl="licenseUrl" in value ? value.licenseUrl : undefined
  if(attribution!==undefined&&(typeof attribution!=="string"||attribution.length===0||attribution.length>999))throw new Error("invalid-asset-provenance")
  if(licenseUrl!==undefined&&(typeof licenseUrl!=="string"||!/^https:\/\//.test(licenseUrl)||licenseUrl.length>999))throw new Error("invalid-asset-provenance")
  if((value.kind==="stock" || value.kind==="icon") && "source" in value && typeof value.source==="string" && "license" in value && typeof value.license==="string" && "provider" in value && typeof value.provider==="string" && "item" in value && typeof value.item==="string" && [value.source,value.license,value.provider,value.item].every(text=>text.length>0&&text.length<1000))return {kind:value.kind,source:value.source,license:value.license,provider:value.provider,item:value.item,...typeof attribution==="string" ? {author:attribution} : {},...typeof licenseUrl==="string" ? {licenseUrl} : {}}
  throw new Error("invalid-asset-provenance")
}

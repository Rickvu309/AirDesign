export type AssetProvenance = { kind:"upload";source:"Personal upload";license:"User supplied" } | { kind:"stock"|"icon";source:string;license:string;provider:string;item:string }
export type AssetSummary={id:string;mime:string;width:number;height:number;bytes:number;provenance:AssetProvenance;listed:boolean}
export const uploadProvenance:AssetProvenance={kind:"upload",source:"Personal upload",license:"User supplied"}
export function parseProvenance(value:unknown):AssetProvenance {
  if(!value || typeof value!=="object" || !("kind" in value))throw new Error("invalid-asset-provenance")
  if(value.kind==="upload")return uploadProvenance
  if((value.kind==="stock" || value.kind==="icon") && "source" in value && typeof value.source==="string" && "license" in value && typeof value.license==="string" && "provider" in value && typeof value.provider==="string" && "item" in value && typeof value.item==="string" && [value.source,value.license,value.provider,value.item].every(text=>text.length>0&&text.length<1000))return {kind:value.kind,source:value.source,license:value.license,provider:value.provider,item:value.item}
  throw new Error("invalid-asset-provenance")
}

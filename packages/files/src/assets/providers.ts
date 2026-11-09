import { readFile } from "node:fs/promises"
import type { AssetProvenance } from "./provenance.ts"
export type ProviderItem={id:string;name:string;keywords:string[];file:string;provenance:AssetProvenance}
export type AssetProvider={id:string;name:string;search:(query:string)=>ProviderItem[];read:(id:string)=>Promise<{bytes:Buffer;provenance:AssetProvenance}>}
const icons=["photo","chart-bar","arrow-trending-up"].map(name=>({id:name,name:name.replaceAll("-"," "),keywords:[name,"icon","business"],file:`icons/${name}.svg`,provenance:{kind:"icon",provider:"heroicons",item:name,source:"https://github.com/tailwindlabs/heroicons",license:"MIT"} as const}))
const stock:ProviderItem[]=[{id:"blue-marble",name:"Earth from Apollo 17",keywords:["earth","planet","space","blue marble"],file:"stock/blue-marble.jpg",provenance:{kind:"stock",provider:"local-stock",item:"blue-marble",source:"https://www.nasa.gov/image-article/blue-marble-view-from-apollo-17/",license:"NASA media usage guidelines; credit NASA/Apollo 17 crew; no endorsement"}}]
function bundled(id:string,name:string,items:ProviderItem[]):AssetProvider {
  return {id,name,search:query=>items.filter(item=>(item.name+" "+item.keywords.join(" ")).toLowerCase().includes(query.trim().toLowerCase())),read:async key=>{const item=items.find(item=>item.id===key);if(!item)throw new Error("provider-item-not-found");return {bytes:await readFile(new URL("./bundled/"+item.file,import.meta.url)),provenance:item.provenance}}}
}
export const assetProviders:readonly AssetProvider[]=[bundled("heroicons","Icons · MIT",icons),bundled("local-stock","Stock photos · local",stock)]

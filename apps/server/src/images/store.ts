import {flatten} from "../../../../packages/deck/src/elements.ts"
import type {NativeDeck} from "../../../../packages/deck/src/text/native-v3.ts"
import type { CatalogSql,CatalogTransaction } from "../../../../packages/catalog/src/index.ts"
import type { Principal } from "../../../../packages/change-log/src/index.ts"
import { type Deck } from "../../../../packages/deck/src/index.ts"
import { assetLimits,type ValidatedImage } from "../../../../packages/files/src/assets/validate.ts"
import type { AssetProvenance,AssetSummary } from "../../../../packages/files/src/assets/provenance.ts"

type AssetRow={hash:string;mime:string;width:number;height:number;bytes:number;provenance:AssetProvenance;listed:boolean}
export async function initializeAssets(tx:CatalogSql) {
  await tx.query("CREATE TABLE IF NOT EXISTS image_owner(owner text PRIMARY KEY,quota bigint NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS image_asset(owner text NOT NULL,hash text NOT NULL,mime text NOT NULL,width integer NOT NULL,height integer NOT NULL,bytes integer NOT NULL,charged bigint NOT NULL,provenance jsonb NOT NULL,listed boolean NOT NULL DEFAULT true,original bytea NOT NULL,normalized bytea NOT NULL,thumbnail bytea NOT NULL,PRIMARY KEY(owner,hash))")
  await tx.query("ALTER TABLE image_asset ADD COLUMN IF NOT EXISTS full_resolution bytea,ADD COLUMN IF NOT EXISTS export_mime text")
}
function summary(row:AssetRow):AssetSummary{return {id:row.hash,mime:row.mime,width:row.width,height:row.height,bytes:row.bytes,provenance:row.provenance,listed:row.listed}}
export async function ownedDeckAssets(tx:CatalogSql,principal:Principal,deck:Deck | NativeDeck,withBytes=false,provenance:Record<string,AssetProvenance>={}):Promise<Record<string,string>> {
  const hashes=[...new Set(deck.slides.flatMap(slide=>flatten(slide.elements).flatMap(element=>element.kind==="image" ? [element.image.asset] : [])))]
  const sources:Record<string,string>={}
  for(const hash of hashes){
    const row=(await tx.query<{full_resolution:Uint8Array|null;export_mime:string;provenance:AssetProvenance}>(withBytes ? "SELECT hash,full_resolution,export_mime,provenance FROM image_asset WHERE owner=$1 AND hash=$2" : "SELECT hash FROM image_asset WHERE owner=$1 AND hash=$2",[principal.personId,hash])).rows[0]
    if(!row)throw new Error("asset-not-found")
    if(withBytes){if(!row.full_resolution)throw new Error("asset-revalidation-required");sources[hash]=`data:${row.export_mime};base64,`+Buffer.from(row.full_resolution).toString("base64");provenance[hash]=row.provenance}
  }
  return sources
}
export function imageStore(transaction:CatalogTransaction,quota=assetLimits.quota) {
  async function capacity(tx:CatalogSql,principal:Principal) {
    await tx.query("INSERT INTO image_owner(owner,quota) VALUES($1,$2) ON CONFLICT(owner) DO NOTHING",[principal.personId,quota])
    const row=(await tx.query<{quota:string}>("SELECT quota FROM image_owner WHERE owner=$1 FOR UPDATE",[principal.personId])).rows[0]
    const used=(await tx.query<{used:string}>("SELECT COALESCE(SUM(charged),0) AS used FROM image_asset WHERE owner=$1",[principal.personId])).rows[0]
    return {quota:Number(row?.quota),used:Number(used?.used ?? 0)}
  }
  async function owned(tx:CatalogSql,principal:Principal,hash:string){const row=(await tx.query<AssetRow>("SELECT hash,mime,width,height,bytes,provenance,listed FROM image_asset WHERE owner=$1 AND hash=$2",[principal.personId,hash])).rows[0];if(!row)throw new Error("asset-not-found");return row}
  return {
    async capacity(principal:Principal){return transaction(tx=>capacity(tx,principal))},
    async list(principal:Principal){return transaction(async tx=>({assets:(await tx.query<AssetRow>("SELECT hash,mime,width,height,bytes,provenance,listed FROM image_asset WHERE owner=$1 AND listed=true ORDER BY hash",[principal.personId])).rows.map(summary),...await capacity(tx,principal)}))},
    async get(principal:Principal,hash:string){return transaction(async tx=>summary(await owned(tx,principal,hash)))},
    async media(principal:Principal,hash:string,kind:"original"|"normalized"|"thumbnail"){return transaction(async tx=>{const row=(await tx.query<{mime:string;data:Uint8Array}>(`SELECT mime,${kind} AS data FROM image_asset WHERE owner=$1 AND hash=$2`,[principal.personId,hash])).rows[0];if(!row)throw new Error("asset-not-found");return {bytes:Buffer.from(row.data),mime:kind==="original" ? row.mime : "image/png"}})},
    async remove(principal:Principal,hash:string){return transaction(async tx=>{await owned(tx,principal,hash);await tx.query("UPDATE image_asset SET listed=false WHERE owner=$1 AND hash=$2",[principal.personId,hash]);return {removed:hash,originalRetained:true}})},
    async adopt(principal:Principal,image:ValidatedImage,provenance:AssetProvenance){return transaction(async tx=>{
      const limit=await capacity(tx,principal)
      const previous=(await tx.query<AssetRow>("SELECT hash,mime,width,height,bytes,provenance,listed FROM image_asset WHERE owner=$1 AND hash=$2",[principal.personId,image.hash])).rows[0]
      if(previous){await tx.query("UPDATE image_asset SET listed=true WHERE owner=$1 AND hash=$2",[principal.personId,image.hash]);return {...summary(previous),listed:true}}
      const original=Buffer.from(image.original,"base64"),normalized=Buffer.from(image.normalized,"base64"),thumbnail=Buffer.from(image.thumbnail,"base64"),full=Buffer.from(image.exportImage,"base64"),charged=original.length+normalized.length+thumbnail.length+full.length
      if(limit.used+charged>limit.quota)throw new Error("image-storage-full")
      await tx.query("INSERT INTO image_asset(owner,hash,mime,width,height,bytes,charged,provenance,original,normalized,thumbnail,full_resolution,export_mime) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",[principal.personId,image.hash,image.mime,image.width,image.height,image.bytes,charged,JSON.stringify(provenance),original,normalized,thumbnail,full,image.exportMime])
      return summary(await owned(tx,principal,image.hash))
    })}
  }
}

import { createHash } from "node:crypto"
import type { CatalogSql,CatalogTransaction } from "../../../../packages/catalog/src/index.ts"
import type { Principal } from "../../../../packages/change-log/src/index.ts"
import type { Deck } from "../../../../packages/deck/src/index.ts"
export async function initializeTemplateSources(tx:CatalogSql){await tx.query("CREATE TABLE IF NOT EXISTS template_source(owner text NOT NULL,id text NOT NULL,version integer NOT NULL,sha text NOT NULL,bytes bytea NOT NULL,PRIMARY KEY(owner,id,version))")}
export function templateSources(transaction:CatalogTransaction){return {
  async save(principal:Principal,id:string,version:number,bytes:Buffer){return transaction(async tx=>{const sha=createHash("sha256").update(bytes).digest("hex");await tx.query("INSERT INTO template_source(owner,id,version,sha,bytes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner,id,version) DO NOTHING",[principal.personId,id,version,sha,bytes]);const row=(await tx.query<{sha:string}>("SELECT sha FROM template_source WHERE owner=$1 AND id=$2 AND version=$3",[principal.personId,id,version])).rows[0];if(row?.sha!==sha)throw new Error("immutable-template-source")})},
  async get(principal:Principal,id:string,version:number){return transaction(async tx=>{const row=(await tx.query<{bytes:Uint8Array}>("SELECT bytes FROM template_source WHERE owner=$1 AND id=$2 AND version=$3",[principal.personId,id,version])).rows[0];if(!row)throw new Error("template-source-not-found");return Buffer.from(row.bytes)})}
}}
export async function captureTemplateSources(tx:CatalogSql,principal:Principal,deck:Deck):Promise<Record<string,string>>{
  const sources:Record<string,string>={}
  for(const slide of deck.slides){const layout=slide.layout;if(!layout)continue;const key=`${layout.template}:${layout.version}`;if(sources[key])continue;const row=(await tx.query<{bytes:Uint8Array}>("SELECT bytes FROM template_source WHERE owner=$1 AND id=$2 AND version=$3",[principal.personId,layout.template,layout.version])).rows[0];if(!row)throw new Error("template-source-not-found");sources[key]=Buffer.from(row.bytes).toString("base64")}
  return sources
}

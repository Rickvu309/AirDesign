import {lockRetainedAccount} from "../../../../packages/access/src/account-retention.ts"
export {lockRetainedAccount} from "../../../../packages/access/src/account-retention.ts"
import {createHash} from "node:crypto"
import type {CatalogSql,CatalogTransaction} from "../../../../packages/catalog/src/index.ts"
export async function initializeAccountDeletion(tx:CatalogSql){
  await tx.query("CREATE TABLE IF NOT EXISTS account_deletion(owner text PRIMARY KEY,requested bigint NOT NULL,deadline bigint NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS account_deletion_receipt(id text PRIMARY KEY,completed bigint)")
}
export function accountDeletionStore(transaction:CatalogTransaction,clock:()=>number){return {
  async enqueue(owner:string){await transaction(async tx=>{
    if(!await lockRetainedAccount(tx,owner,true))return
    await tx.query("INSERT INTO account_deletion(owner,requested,deadline) VALUES($1,$2,$3) ON CONFLICT(owner) DO NOTHING",[owner,clock(),clock()+30*86400000])
    await tx.query("UPDATE oauth_connection SET data=jsonb_set(data,'{revoked}','true') WHERE data->>'owner'=$1",[owner])
  })},
  async pending(){return transaction(async tx=>(await tx.query<{owner:string;deadline:number}>("SELECT owner,deadline FROM account_deletion ORDER BY requested LIMIT 100")).rows)},
  async purge(owner:string){return transaction(async tx=>{
    if(!await lockRetainedAccount(tx,owner,true))return false
    const pending=(await tx.query("SELECT owner FROM account_deletion WHERE owner=$1 FOR UPDATE",[owner])).rows
    if(!pending.length)return false
    for(const table of ["editing_run_credential","editing_receipt","editing_event","editing_contribution","editing_run","editing_property","editing_key"])await tx.query(`DELETE FROM ${table} WHERE deck IN (SELECT id FROM editing_deck WHERE owner=$1)`,[owner])
    await tx.query("DELETE FROM editing_deck WHERE owner=$1",[owner])
    for(const table of ["catalog_request","owned_file","tool_snapshot","image_asset","image_owner","template_source","aira_preference"])await tx.query(`DELETE FROM ${table} WHERE owner=$1`,[owner])
    await tx.query("DELETE FROM oauth_refresh WHERE connection IN (SELECT id FROM oauth_connection WHERE data->>'owner'=$1)",[owner])
    await tx.query("DELETE FROM oauth_connection WHERE data->>'owner'=$1",[owner])
    await tx.query("DELETE FROM oauth_code WHERE data->'approval'->>'owner'=$1",[owner])
    await tx.query("DELETE FROM oauth_approval WHERE data->>'owner'=$1",[owner])
    await tx.query("DELETE FROM usage_payment_receipt WHERE payment IN (SELECT id FROM usage_payment WHERE owner=$1)",[owner])
    await tx.query("DELETE FROM usage_payment WHERE owner=$1",[owner])
    await tx.query("DELETE FROM usage_event WHERE owner=$1",[owner])
    await tx.query("DELETE FROM usage_reservation WHERE owner=$1",[owner])
    await tx.query("DELETE FROM usage_account WHERE owner=$1",[owner])
    await tx.query("INSERT INTO account_deletion_receipt(id,completed) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET completed=$2",[createHash("sha256").update(owner).digest("hex"),clock()])
    await tx.query("DELETE FROM account_deletion WHERE owner=$1",[owner])
    return true
  })}
}}

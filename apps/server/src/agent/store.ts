import type {CatalogSql,CatalogTransaction} from "../../../../packages/catalog/src/index.ts"
import type {AgentRun} from "../../../../packages/agent/src/activity.ts"
export type {AgentRun,RunActivity,ActivityContent} from "../../../../packages/agent/src/activity.ts"
export async function initializeAgents(tx:CatalogSql){
  await tx.query("CREATE TABLE IF NOT EXISTS aira_preference(owner text PRIMARY KEY,enabled boolean NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS aira_run(id text PRIMARY KEY,owner text NOT NULL,deck text NOT NULL REFERENCES editing_deck(id) ON DELETE CASCADE,data jsonb NOT NULL,created bigint NOT NULL,position bigserial NOT NULL)")
}
export function agentStore(transaction:CatalogTransaction,clock:()=>number){return {
  async enabled(owner:string){return transaction(async tx=>(await tx.query<{enabled:boolean}>("SELECT enabled FROM aira_preference WHERE owner=$1",[owner])).rows[0]?.enabled ?? true)},
  async configure(owner:string,enabled:boolean){await transaction(async tx=>{await tx.query("INSERT INTO aira_preference(owner,enabled) VALUES($1,$2) ON CONFLICT(owner) DO UPDATE SET enabled=$2",[owner,enabled])})},
  async latest(owner:string,deck:string){return transaction(async tx=>(await tx.query<{data:AgentRun}>("SELECT data FROM aira_run WHERE owner=$1 AND deck=$2 ORDER BY position DESC LIMIT 1",[owner,deck])).rows[0]?.data ?? null)},
  async save(run:AgentRun){await transaction(async tx=>{await tx.query("INSERT INTO aira_run(id,owner,deck,data,created) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=$4",[run.id,run.owner,run.deck,JSON.stringify(run),clock()])})}
}}

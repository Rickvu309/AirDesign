import {createHash} from "node:crypto"
type RetentionTransaction={query:<R>(sql:string,params?:unknown[])=>Promise<{rows:R[]}>}
export async function lockRetainedAccount(tx:RetentionTransaction,owner:string,deleting=false){
  const id=createHash("sha256").update(owner).digest("hex")
  await tx.query("INSERT INTO account_deletion_receipt(id,completed) VALUES($1,NULL) ON CONFLICT(id) DO NOTHING",[id])
  const state=await tx.query<{completed:number|null}>("SELECT completed FROM account_deletion_receipt WHERE id=$1 FOR UPDATE",[id])
  if(state.rows[0]?.completed!==null){if(deleting)return false;throw new Error("account-deleted")}
  if(!deleting&&(await tx.query("SELECT 1 FROM account_deletion WHERE owner=$1",[owner])).rows.length)throw new Error("account-deleting")
  return true
}

import type {TextProtocol} from "../../rpc/src/text/protocol.ts"
import {createHash,randomUUID} from "node:crypto"
import type {UsageTransaction,UsageTransactions} from "../../usage/src/ledger.ts"
export const toolTextLimit=19500
export function textResult(value:unknown,isError=false){
  const fields=value&&typeof value==="object" ? Object.fromEntries(Object.entries(value)) : {}
  const code=typeof fields.code==="string" ? fields.code : typeof fields.kind==="string" ? fields.kind : "tool-failed"
  const recovery=code==="out-of-usage" ? "Open /settings/usage or wait for the weekly reset." : code==="stale-base" ? "Read the current deck version, rebase the complete batch, and use a new requestId." : "Read the target again, check ownership and arguments, and submit a corrected request."
  const payload=isError ? {ok:false,error:{code,message:typeof fields.message==="string" ? fields.message : code.replaceAll("-"," "),retryable:false,recovery,details:value}} : {ok:true,data:value}
  return {content:[{type:"text" as const,text:JSON.stringify(payload)}],...(isError ? {isError:true} : {})}
}
export function boundedResult(value:unknown){const result=textResult(value);if(Buffer.byteLength(JSON.stringify(result))>toolTextLimit)throw new Error("result-too-large-use-target-or-resource");return result}
export async function initializeToolSnapshots(tx:UsageTransaction){
  await tx.query("CREATE TABLE IF NOT EXISTS tool_snapshot(id text PRIMARY KEY,owner text NOT NULL,query text NOT NULL,data jsonb NOT NULL,expires bigint NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS tool_cursor(id text PRIMARY KEY,snapshot text NOT NULL REFERENCES tool_snapshot(id) ON DELETE CASCADE,position integer NOT NULL)")
}
export function toolSnapshots(transaction:UsageTransactions,clock=Date.now,protocol:TextProtocol="legacy-text-v2"){
  async function retained(tx:UsageTransaction,id:string,owner:string,cursor=false){
    if(protocol!=="paragraph-body-v3")return
    const row=(await tx.query<{retired:boolean}>(cursor ? "SELECT s.retired FROM tool_cursor c JOIN tool_snapshot s ON s.id=c.snapshot WHERE c.id=$1 AND s.owner=$2" : "SELECT retired FROM tool_snapshot WHERE id=$1 AND owner=$2",[id,owner])).rows[0]
    if(row?.retired)throw new Error("editing-protocol-requires-new-snapshot")
  }
  return {
    async binary(owner:string,bytes:Buffer){
      return transaction(async tx=>{const id=randomUUID(),expires=clock()+15*60000;await tx.query("DELETE FROM tool_snapshot WHERE expires<=$1",[clock()]);await tx.query("INSERT INTO tool_snapshot(id,owner,query,data,expires) VALUES($1,$2,$3,$4,$5)",[id,owner,"capture",JSON.stringify({base64:bytes.toString("base64")}),expires]);return {resource:`airdesign://captures/${id}`,expires}})
    },
    async resource(owner:string,id:string){return transaction(async tx=>{await retained(tx,id,owner);const row=(await tx.query<{data:unknown}>("SELECT data FROM tool_snapshot WHERE id=$1 AND owner=$2 AND expires>$3",[id,owner,clock()])).rows[0];if(!row)throw new Error("resource-not-found");return row.data})},
    async page(owner:string,tool:string,args:Record<string,unknown>,load:()=>Promise<{items:unknown[];meta:Record<string,unknown>}>){
      const {cursor,...query}=args,limit=typeof args.limit==="number" ? args.limit : 20
      const digest=createHash("sha256").update(JSON.stringify({tool,query:Object.entries(query).sort(([a],[b])=>a.localeCompare(b))})).digest("hex")
      if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new Error("invalid-page-size")
      const fresh=cursor===undefined ? await load() : null
      return transaction(async tx=>{
        let snapshot:string,offset:number,data:{items:unknown[];meta:Record<string,unknown>}
        if(cursor!==undefined){
          if(typeof cursor!=="string")throw new Error("invalid-cursor")
          await retained(tx,cursor,owner,true)
          const row=(await tx.query<{id:string;position:number;data:typeof data}>("SELECT s.id,c.position AS position,s.data FROM tool_cursor c JOIN tool_snapshot s ON s.id=c.snapshot WHERE c.id=$1 AND s.owner=$2 AND s.query=$3 AND s.expires>$4",[cursor,owner,digest,clock()])).rows[0]
          if(!row)throw new Error("invalid-or-expired-cursor")
          snapshot=row.id;offset=row.position;data=row.data
        }else{
          if(!fresh)throw new Error("snapshot-required")
          data=fresh;offset=0;snapshot=randomUUID()
          await tx.query("DELETE FROM tool_snapshot WHERE expires<=$1",[clock()])
          await tx.query("INSERT INTO tool_snapshot(id,owner,query,data,expires) VALUES($1,$2,$3,$4,$5)",[snapshot,owner,digest,JSON.stringify(data),clock()+15*60000])
        }
        const items:unknown[]=[]
        for(const item of data.items.slice(offset,offset+limit)){
          const candidate={...data.meta,snapshot,items:[...items,item],nextCursor:"x".repeat(36)}
          if(Buffer.byteLength(JSON.stringify(textResult(candidate)))>toolTextLimit){if(!items.length)items.push({resource:`airdesign://snapshots/${snapshot}?index=${offset}&offset=0`,index:offset,reason:"subtree-exceeds-envelope"});break}
          items.push(item)
        }
        const next=offset+items.length<data.items.length ? randomUUID() : null
        if(next)await tx.query("INSERT INTO tool_cursor(id,snapshot,position) VALUES($1,$2,$3)",[next,snapshot,offset+items.length])
        return boundedResult({...data.meta,snapshot,items,nextCursor:next})
      })
    },
  }
}

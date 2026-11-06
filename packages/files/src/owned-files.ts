import {createHash,randomUUID} from "node:crypto"
import {fileLimits} from "./index.ts"
import type {UsageTransaction,UsageTransactions} from "../../usage/src/ledger.ts"
type FileRow={id:string;name:string;mime:string;bytes:Uint8Array;sha:string}
export async function initializeOwnedFiles(tx:UsageTransaction){await tx.query("CREATE TABLE IF NOT EXISTS owned_file(id text PRIMARY KEY,owner text NOT NULL,request text NOT NULL,input text NOT NULL,name text NOT NULL,mime text NOT NULL,bytes bytea NOT NULL,sha text NOT NULL,UNIQUE(owner,request))")}
export function ownedFiles(transaction:UsageTransactions){
  const metadata=(row:FileRow)=>({fileId:row.id,name:row.name,mime:row.mime,bytes:row.bytes.length,sha256:row.sha,resource:`airdesign://files/${row.id}`})
  return {
    async save(owner:string,request:string,input:string,name:string,load:()=>Promise<{bytes:Buffer;mime:string}>){
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(request)||!name.trim()||name.length>200||input.length>2500)throw new Error("invalid-file-request")
      const existing=await transaction(async tx=>(await tx.query<FileRow&{input:string}>("SELECT * FROM owned_file WHERE owner=$1 AND request=$2",[owner,request])).rows[0])
      if(existing){if(existing.input!==input)throw new Error("request-id-payload-mismatch");return metadata(existing)}
      const {bytes,mime}=await load();if(bytes.length<1||bytes.length>fileLimits.compressed||mime.length>200)throw new Error("invalid-file-size")
      const sha=createHash("sha256").update(bytes).digest("hex")
      return transaction(async tx=>{
        await tx.query("INSERT INTO owned_file(id,owner,request,input,name,mime,bytes,sha) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(owner,request) DO NOTHING",[randomUUID(),owner,request,input,name,mime,bytes,sha])
        const row=(await tx.query<FileRow&{input:string}>("SELECT * FROM owned_file WHERE owner=$1 AND request=$2",[owner,request])).rows[0]
        if(!row||row.input!==input)throw new Error("request-id-payload-mismatch")
        return metadata(row)
      })
    },
    async read(owner:string,id:string){return transaction(async tx=>{const row=(await tx.query<FileRow>("SELECT * FROM owned_file WHERE id=$1 AND owner=$2",[id,owner])).rows[0];if(!row)throw new Error("file-not-found");return {...metadata(row),content:Buffer.from(row.bytes)}})},
  }
}

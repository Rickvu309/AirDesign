import { randomUUID,createHash } from "node:crypto"
import { id, parseDeck, themeId, type Deck } from "../../deck/src/index.ts"
import { initialHistory, type History, type Principal } from "../../change-log/src/index.ts"

export type CatalogSql = { query<R>(sql:string,params?:unknown[]):Promise<{rows:R[]}> }
export type CatalogTransaction = <T>(work:(tx:CatalogSql)=>Promise<T>)=>Promise<T>
export type CatalogSource={bytes:Buffer;report:Record<string,unknown>}
export type DeckEntry = { id:string;title:string;updated:number;deletedAt:number|null;generation:number;pendingRequest:string;slides:number }
type Row = {id:string;title:string;updated_at:number;deleted_at:number|null;pending_request:string;state:History;deleted:boolean;trash_generation:number}
const day=24*60*60*1000
function entry(row:Row):DeckEntry {return {id:row.id,title:row.title,updated:Number(row.updated_at),deletedAt:row.deleted_at===null ? null : Number(row.deleted_at),pendingRequest:row.pending_request,generation:Number(row.trash_generation),slides:row.state.deck.slides.length}}
function title(value:string) {const text=value.trim();if(!text || text.length>200)throw new Error("invalid-deck-title");return text}
function newId() {return id(`d${randomUUID().replaceAll("-","").slice(0,30)}`)}
export async function initializeCatalog(tx:CatalogSql) {
  await tx.query("ALTER TABLE editing_deck ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Untitled deck'")
  await tx.query("ALTER TABLE editing_deck ADD COLUMN IF NOT EXISTS updated_at double precision NOT NULL DEFAULT 0")
  await tx.query("ALTER TABLE editing_deck ADD COLUMN IF NOT EXISTS deleted_at double precision")
  await tx.query("ALTER TABLE editing_deck ADD COLUMN IF NOT EXISTS pending_request text NOT NULL DEFAULT ''")
  await tx.query("UPDATE editing_deck SET deleted_at=updated_at WHERE deleted=true AND deleted_at IS NULL")
  await tx.query("ALTER TABLE editing_deck ADD COLUMN IF NOT EXISTS trash_generation integer NOT NULL DEFAULT 0")
  await tx.query("CREATE INDEX IF NOT EXISTS catalog_owner_updated ON editing_deck(owner,updated_at DESC)")
  await tx.query("CREATE TABLE IF NOT EXISTS catalog_source(deck text PRIMARY KEY REFERENCES editing_deck(id) ON DELETE CASCADE,bytes bytea NOT NULL,report jsonb NOT NULL)")
  await tx.query("CREATE TABLE IF NOT EXISTS catalog_request(owner text NOT NULL, request text NOT NULL, input jsonb NOT NULL, deck text NOT NULL, PRIMARY KEY(owner,request))")
}
export function createCatalog(transaction:CatalogTransaction,clock=Date.now) {
  async function owned(tx:CatalogSql,principal:Principal,deck:string) {
    const result=await tx.query<Row>("SELECT * FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE",[deck,principal.personId])
    const row=result.rows[0];if(!row)throw new Error("deck-not-found");return row
  }
  async function remove(tx:CatalogSql,deck:string) {
    for(const table of ["editing_run_credential","editing_receipt","editing_event","editing_contribution","editing_run","editing_property","editing_key"])await tx.query(`DELETE FROM ${table} WHERE deck=$1`,[deck])
    await tx.query("DELETE FROM catalog_request WHERE deck=$1",[deck])
    await tx.query("DELETE FROM editing_deck WHERE id=$1",[deck])
  }
  return {
    async list(principal:Principal,trash=false,search="") {return transaction(async tx=>{
      const result=await tx.query<Row>("SELECT * FROM editing_deck WHERE owner=$1 AND deleted=$2 AND strpos(lower(title||' '||(state->'deck'->'slides')::text),lower($3))>0 ORDER BY updated_at DESC,id",[principal.personId,trash,search])
      return result.rows.map(entry)
    })},
    async create(principal:Principal,request:string,name:string,pendingRequest="",source?:Deck,original?:CatalogSource) {return transaction(async tx=>{
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(request) || pendingRequest.length>20000)throw new Error("invalid-create-request")
      const input={name:title(name),pendingRequest,source:source ?? null,original:original ? createHash("sha256").update(original.bytes).digest("hex") : null},deckId=newId()
      await tx.query("INSERT INTO catalog_request(owner,request,input,deck) VALUES ($1,$2,$3,$4) ON CONFLICT(owner,request) DO NOTHING",[principal.personId,request,JSON.stringify(input),deckId])
      const previous=await tx.query<{deck:string;input:typeof input}>("SELECT deck,input FROM catalog_request WHERE owner=$1 AND request=$2",[principal.personId,request])
      const prior=previous.rows[0];if(!prior)throw new Error("create-failed")
      if(canonical(prior.input)!==canonical(input))throw new Error("request-id-payload-conflict")
      if(prior.deck!==deckId)return entry(await owned(tx,principal,prior.deck))
      const deck=source ? parseDeck({...source,id:deckId}) : {id:deckId,version:0,slides:[],themes:[{id:themeId("default"),font:"Geist",background:"#ffffff"}]}
      await tx.query("INSERT INTO editing_deck(id,owner,state,title,updated_at,pending_request) VALUES ($1,$2,$3,$4,$5,$6)",[deckId,principal.personId,JSON.stringify(initialHistory(deck)),input.name,clock(),pendingRequest])
      if(original)await tx.query("INSERT INTO catalog_source(deck,bytes,report) VALUES($1,$2,$3)",[deckId,original.bytes,JSON.stringify(original.report)])
      return entry(await owned(tx,principal,deckId))
    })},
    async original(principal:Principal,deck:string):Promise<CatalogSource|null> {return transaction(async tx=>{await owned(tx,principal,deck);const row=(await tx.query<{bytes:Uint8Array;report:Record<string,unknown>}>("SELECT bytes,report FROM catalog_source WHERE deck=$1",[deck])).rows[0];return row ? {bytes:Buffer.from(row.bytes),report:row.report} : null})},
    async details(principal:Principal,deck:string) {return transaction(async tx=>entry(await owned(tx,principal,deck)))},
    async readDeleted(principal:Principal,deck:string) {return transaction(async tx=>{const row=await owned(tx,principal,deck);return {deck:row.state.deck,seq:row.state.seq,deleted:row.deleted}})},
    async rename(principal:Principal,deck:string,name:string) {return transaction(async tx=>{const row=await owned(tx,principal,deck);if(row.deleted)throw new Error("deck-deleted");await tx.query("UPDATE editing_deck SET title=$2,updated_at=$3 WHERE id=$1",[deck,title(name),clock()]);return entry(await owned(tx,principal,deck))})},
    async pending(principal:Principal,deck:string,text:string) {return transaction(async tx=>{const row=await owned(tx,principal,deck);if(row.deleted)throw new Error("deck-deleted");if(text.length>20000)throw new Error("request-too-long");await tx.query("UPDATE editing_deck SET pending_request=$2 WHERE id=$1",[deck,text]);return entry(await owned(tx,principal,deck))})},
    async trash(principal:Principal,deck:string) {return transaction(async tx=>{
      const row=await owned(tx,principal,deck)
      if(!row.deleted){
        const state={...row.state,runs:row.state.runs.map(run=>run.kind==="open" ? {...run,kind:"closed" as const,epoch:run.epoch+1} : run)}
        await tx.query("UPDATE editing_deck SET deleted=true,deleted_at=$2,trash_generation=trash_generation+1,state=$3 WHERE id=$1",[deck,clock(),JSON.stringify(state)])
        await tx.query("UPDATE editing_run SET payload=jsonb_set(jsonb_set(payload,'{kind}','\"closed\"'::jsonb),'{epoch}',to_jsonb((payload->>'epoch')::integer+1)) WHERE deck=$1 AND payload->>'kind'='open'",[deck])
        await tx.query("DELETE FROM editing_run_credential WHERE deck=$1",[deck])
      }
      return entry(await owned(tx,principal,deck))
    })},
    async restore(principal:Principal,deck:string) {return transaction(async tx=>{const row=await owned(tx,principal,deck);if(row.deleted_at!==null && Number(row.deleted_at)<=clock()-30*day)throw new Error("deck-expired");await tx.query("UPDATE editing_deck SET deleted=false,deleted_at=NULL,updated_at=$2 WHERE id=$1",[deck,clock()]);return entry(await owned(tx,principal,deck))})},
    async emptyTrash(principal:Principal,confirmed:{id:string;generation:number}[]) {return transaction(async tx=>{
      const removed:string[]=[]
      for(const target of [...confirmed].sort((a,b)=>a.id.localeCompare(b.id))){
        const row=(await tx.query<{id:string}>("SELECT id FROM editing_deck WHERE id=$1 AND owner=$2 AND deleted=true AND trash_generation=$3 FOR UPDATE",[target.id,principal.personId,target.generation])).rows[0]
        if(row){await remove(tx,row.id);removed.push(row.id)}
      }
      return removed
    })},
    async purge() {return transaction(async tx=>{const result=await tx.query<{id:string}>("SELECT id FROM editing_deck WHERE deleted=true AND deleted_at<=$1 ORDER BY id FOR UPDATE SKIP LOCKED",[clock()-30*day]);for(const row of result.rows)await remove(tx,row.id);return result.rows.map(row=>row.id)})},
  }
}
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`
  if(value && typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

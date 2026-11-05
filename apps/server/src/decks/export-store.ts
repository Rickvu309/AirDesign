import { captureTemplateSources } from "../templates/source-store.ts"
import { ownedDeckAssets } from "../images/store.ts"
import { randomUUID,createHash } from "node:crypto"
import type { CatalogSql,CatalogTransaction } from "../../../../packages/catalog/src/index.ts"
import type { History,Principal } from "../../../../packages/change-log/src/index.ts"
import type { Deck } from "../../../../packages/deck/src/index.ts"

export type ExportOptions={format:"pptx"|"pdf";slides:string[];timing:"now"|"after-run";expectedSeq:number;allowIssues:boolean}
export type SavedVersion={deck:Deck;seq:number;source:string|null;title:string;assets?:Record<string,string>;templates?:Record<string,string>}
export type ExportJob={id:string;deck:string;format:ExportOptions["format"];attempts:number;options:ExportOptions;diagnostics:string[]}&(
  {kind:"waiting"|"queued"|"running"|"cancelled"|"expired"}|{kind:"failed";reason:string}|{kind:"ready";seq:number;sha256:string;expires:number;report:Record<string,unknown>}
)
type Row={id:string;owner:string;deck:string;options:ExportOptions;snapshot:SavedVersion|null;state:ExportJob["kind"];attempts:number;diagnostics:string[];lease:string|null;deadline:number|null;reason:string|null;result:Uint8Array|null;sha:string|null;expires:number|null;report:Record<string,unknown>}
const resultLife=7*86400000
export async function initializeExports(tx:CatalogSql) {
  await tx.query("CREATE TABLE IF NOT EXISTS deck_export(id text PRIMARY KEY,owner text NOT NULL,request text NOT NULL,deck text NOT NULL REFERENCES editing_deck(id) ON DELETE CASCADE,options jsonb NOT NULL,snapshot jsonb,state text NOT NULL,attempts integer NOT NULL DEFAULT 0,diagnostics jsonb NOT NULL DEFAULT '[]',lease text,deadline double precision,reason text,result bytea,sha text,expires double precision,report jsonb NOT NULL DEFAULT '{}',UNIQUE(owner,request))")
  await tx.query("ALTER TABLE deck_export ADD COLUMN IF NOT EXISTS created double precision NOT NULL DEFAULT 0")
}
function exposed(row:Row):ExportJob {
  const base={id:row.id,deck:row.deck,format:row.options.format,attempts:row.attempts,options:row.options,diagnostics:row.diagnostics}
  if(row.state==="ready"){if(!row.snapshot || !row.sha || row.expires===null)throw new Error("invalid-export-result");return {...base,kind:"ready",seq:row.snapshot.seq,sha256:row.sha,expires:Number(row.expires),report:row.report}}
  if(row.state==="failed")return {...base,kind:"failed",reason:row.reason ?? "export-failed"}
  return {...base,kind:row.state}
}
function valid(options:ExportOptions) {
  if(!["pptx","pdf"].includes(options.format)||!["now","after-run"].includes(options.timing)||!Array.isArray(options.slides)||options.slides.some(value=>typeof value!=="string")||new Set(options.slides).size!==options.slides.length||!Number.isSafeInteger(options.expectedSeq)||options.expectedSeq<0||typeof options.allowIssues!=="boolean")throw new Error("invalid-export-options")
}
export function exportStore(transaction:CatalogTransaction,clock=Date.now) {
  async function owned(tx:CatalogSql,principal:Principal,id:string) {const row=(await tx.query<Row>("SELECT * FROM deck_export WHERE id=$1 AND owner=$2 FOR UPDATE",[id,principal.personId])).rows[0];if(!row)throw new Error("export-not-found");if(row.state==="ready" && Number(row.expires)<=clock()){await tx.query("UPDATE deck_export SET state='expired',result=NULL WHERE id=$1",[id]);return {...row,state:"expired" as const,result:null}}return row}
  async function capture(tx:CatalogSql,deck:string,owner:string) {
    const row=(await tx.query<{state:History;deleted:boolean;title:string}>("SELECT state,deleted,title FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE",[deck,owner])).rows[0]
    if(!row)throw new Error("deck-not-found");if(row.deleted)throw new Error("deck-deleted")
    const source=(await tx.query<{bytes:Uint8Array}>("SELECT bytes FROM catalog_source WHERE deck=$1",[deck])).rows[0]
    const templates=await captureTemplateSources(tx,{personId:owner},row.state.deck)
    const assets=await ownedDeckAssets(tx,{personId:owner},row.state.deck,true)
    return {snapshot:{templates,assets,title:row.title,deck:row.state.deck,seq:row.state.seq,source:source ? Buffer.from(source.bytes).toString("base64") : null},running:(await tx.query<{payload:History["runs"][number]}>("SELECT payload FROM editing_run WHERE deck=$1",[deck])).rows.some(run=>run.payload.kind==="open")}
  }
  return {
    async submit(principal:Principal,request:string,deck:string,options:ExportOptions) {valid(options);if(!/^[A-Za-z0-9_-]{1,100}$/.test(request))throw new Error("invalid-request-id");return transaction(async tx=>{
      const current=await capture(tx,deck,principal.personId)
      const previous=(await tx.query<Row>("SELECT * FROM deck_export WHERE owner=$1 AND request=$2",[principal.personId,request])).rows[0]
      if(previous){if(previous.deck!==deck||JSON.stringify(Object.entries(previous.options).sort())!==JSON.stringify(Object.entries(options).sort()))throw new Error("request-id-payload-conflict");return exposed(previous)}
      if(options.timing==="now" && current.snapshot.seq!==options.expectedSeq)throw new Error("saved-version-changed")
      const selected=options.slides.length ? options.slides : current.snapshot.deck.slides.map(slide=>slide.id)
      if(!selected.length || selected.some(id=>!current.snapshot.deck.slides.some(slide=>slide.id===id)))throw new Error("invalid-slide-range")
      const waiting=options.timing==="after-run" && current.running,id=randomUUID()
      await tx.query("INSERT INTO deck_export(id,owner,request,deck,options,snapshot,state,created) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id,principal.personId,request,deck,JSON.stringify(options),waiting ? null : JSON.stringify(current.snapshot),waiting ? "waiting" : "queued",clock()])
      return exposed(await owned(tx,principal,id))
    })},
    async list(principal:Principal,deck:string){return transaction(async tx=>(await tx.query<Row>("SELECT * FROM deck_export WHERE owner=$1 AND deck=$2 ORDER BY created,id",[principal.personId,deck])).rows.map(exposed))},
    async active(id:string,lease:string){return transaction(async tx=>(await tx.query<{id:string}>("SELECT id FROM deck_export WHERE id=$1 AND lease=$2 AND state='running'",[id,lease])).rows.length===1)},
    async status(principal:Principal,id:string){return transaction(async tx=>exposed(await owned(tx,principal,id)))},
    async artifact(principal:Principal,id:string){return transaction(async tx=>{const row=await owned(tx,principal,id);if(row.state!=="ready"||!row.result)throw new Error("export-artifact-unavailable");return {bytes:Buffer.from(row.result),format:row.options.format,seq:row.snapshot?.seq,title:row.snapshot?.title ?? "AirDesign"}})},
    async cancel(principal:Principal,id:string){return transaction(async tx=>{const row=await owned(tx,principal,id);if(["waiting","queued","running"].includes(row.state))await tx.query("UPDATE deck_export SET state='cancelled',result=NULL,lease=NULL WHERE id=$1",[id]);return exposed(await owned(tx,principal,id))})},
    async retry(principal:Principal,id:string){return transaction(async tx=>{const row=await owned(tx,principal,id);if(row.state!=="failed"||row.attempts>=3)throw new Error("export-retry-unavailable");await tx.query("UPDATE deck_export SET state='queued',reason=NULL,lease=NULL WHERE id=$1",[id]);return exposed(await owned(tx,principal,id))})},
    async claim(){await transaction(async tx=>{
      await tx.query("UPDATE deck_export SET state=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,reason='worker-deadline-exceeded',diagnostics=diagnostics || '[\"worker-deadline-exceeded\"]'::jsonb,lease=NULL WHERE state='running' AND deadline<=$1",[clock()])
      await tx.query("UPDATE deck_export SET state='expired',result=NULL WHERE state='ready' AND expires<=$1",[clock()])
      });return transaction(async tx=>{
      const waiting=(await tx.query<Row>("SELECT e.* FROM deck_export e JOIN editing_deck d ON d.id=e.deck WHERE e.state='waiting' ORDER BY d.id,e.id FOR UPDATE OF d SKIP LOCKED LIMIT 100")).rows
      for(const row of waiting){const locked=(await tx.query<Row>("SELECT * FROM deck_export WHERE id=$1 AND state='waiting' FOR UPDATE SKIP LOCKED",[row.id])).rows[0];if(!locked)continue;try{const current=await capture(tx,row.deck,row.owner);if(!current.running)await tx.query("UPDATE deck_export SET state='queued',snapshot=$2 WHERE id=$1",[row.id,JSON.stringify(current.snapshot)])}catch(error){await tx.query("UPDATE deck_export SET state='failed',reason=$2 WHERE id=$1",[row.id,error instanceof Error ? error.message : "capture-failed"])}}
      const row=(await tx.query<Row>("SELECT * FROM deck_export WHERE state='queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0]
      if(!row)return null
      if(!row.snapshot)throw new Error("saved-version-required")
      const lease=randomUUID(),deadline=clock()+(row.options.format==="pdf" ? 2000 : 30000)
      await tx.query("UPDATE deck_export SET state='running',lease=$2,deadline=$3,attempts=attempts+1 WHERE id=$1",[row.id,lease,deadline])
      return {id:row.id,lease,deadline,options:row.options,snapshot:row.snapshot}
    })},
    async complete(id:string,lease:string,result:Buffer,report:Record<string,unknown>){return transaction(async tx=>{const changed=await tx.query<{id:string}>("UPDATE deck_export SET state='ready',result=$3,report=$4,sha=$5,expires=$6,lease=NULL WHERE id=$1 AND lease=$2 AND state='running' AND deadline>$7 RETURNING id",[id,lease,result,JSON.stringify(report),createHash("sha256").update(result).digest("hex"),clock()+resultLife,clock()]);return changed.rows.length===1})},
    async fail(id:string,lease:string,reason:string){return transaction(async tx=>{await tx.query("UPDATE deck_export SET state='failed',reason=$3,diagnostics=diagnostics || $4::jsonb,lease=NULL WHERE id=$1 AND lease=$2 AND state='running'",[id,lease,reason,JSON.stringify([reason])])})},
  }
}

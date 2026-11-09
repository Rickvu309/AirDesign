import {initializeAccountDeletion,accountDeletionStore,lockRetainedAccount} from "../account/deletion-store.ts"
import {initializeAgents,agentStore} from "../agent/store.ts"
import {initializeOwnedFiles,ownedFiles} from "../../../../packages/files/src/owned-files.ts"
import {initializeToolSnapshots,toolSnapshots} from "../../../../packages/tools/src/snapshots.ts"
import { initializeOAuth, oauthStore } from "../../../../packages/access/src/oauth/store.ts"
import { initializeUsage, usageLedger } from "../../../../packages/usage/src/ledger.ts"
import { initializeTemplateSources,templateSources,captureTemplateSources } from "../templates/source-store.ts"
import { initializeAssets,imageStore,ownedDeckAssets } from "../images/store.ts"
import { initializeExports,exportStore } from "../decks/export-store.ts"
import { createCatalog, initializeCatalog } from "../../../../packages/catalog/src/index.ts"
import { PGlite } from "@electric-sql/pglite"
import pg from "pg"
import { createHash, randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { execute, executionMatches, initialHistory, type Command, type History, type Principal, type Receipt, type ExecutionIdentity, type Contribution, type RunState, commandId } from "../../../../packages/change-log/src/index.ts"
import type { ChangeSet, Deck } from "../../../../packages/deck/src/index.ts"
import { currentProjection, initializeHistoryIndex, loadHistoryIndex, saveHistoryIndex } from "./history-index.ts"

type Transaction = Pick<PGlite, "query">
export type HistoryStore = Awaited<ReturnType<typeof createHistoryStore>>
export async function createHistoryStore(driver: { kind: "pglite"; path?: string; client?: PGlite } | { kind: "postgres"; url: string }, clock=Date.now) {
  if (driver.kind === "pglite" && driver.path && driver.path!=="memory://") await mkdir(driver.path, { recursive: true })
  const local = driver.kind === "pglite" ? driver.client ?? new PGlite(driver.path) : null
  const pool = driver.kind === "postgres" ? new pg.Pool({connectionString:driver.url,max:4}) : null
  const connections = new Set<Promise<void>>()
  pool?.on("connect", client => {
    const ended = new Promise<void>(resolve => client.once("end", resolve))
    connections.add(ended)
    void ended.then(() => connections.delete(ended))
  })
  let closed = false
  async function transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    if (closed) throw new Error("database-closed")
    if (local) return local.transaction(work)
    if (!pool) throw new Error("database-closed")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const tx: Transaction = { query: async <R>(sql: string, params?: unknown[]) => {
        const result = await client.query(sql, params)
        return { rows: result.rows.map(row => row as R), affectedRows: result.rowCount ?? 0, fields: [] }
      } }
      const result = await work(tx)
      await client.query("COMMIT")
      return result
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  }
  await transaction(async tx => { await tx.query("CREATE TABLE IF NOT EXISTS editing_deck (id text PRIMARY KEY, owner text NOT NULL, state jsonb NOT NULL, deleted boolean NOT NULL DEFAULT false)")
    await tx.query("CREATE TABLE IF NOT EXISTS editing_receipt (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, payload text NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY(deck,id))")
    await tx.query("CREATE TABLE IF NOT EXISTS editing_event (deck text NOT NULL REFERENCES editing_deck(id), seq integer NOT NULL, command jsonb NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY(deck,seq))")
    await tx.query("CREATE UNIQUE INDEX IF NOT EXISTS editing_event_command ON editing_event(deck,((command->>'id')))")
    await tx.query("CREATE TABLE IF NOT EXISTS editing_run_credential (token text PRIMARY KEY, deck text NOT NULL REFERENCES editing_deck(id), run text NOT NULL)")
    await initializeAccountDeletion(tx);await initializeAgents(tx);await initializeOwnedFiles(tx); await initializeToolSnapshots(tx); await initializeOAuth(tx); await initializeUsage(tx); await initializeHistoryIndex(tx); await initializeCatalog(tx);await initializeExports(tx);await initializeAssets(tx);await initializeTemplateSources(tx) })
  async function owned(tx: Transaction, principal: Principal, deckId: string) {
    await lockRetainedAccount(tx,principal.personId)
    const result = await tx.query<{ state: History; deleted: boolean }>("SELECT state, deleted FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE", [deckId, principal.personId])
    const row = result.rows[0]
    if (!row) throw new Error("deck-not-found")
    if (row.deleted) throw new Error("deck-deleted")
    return row.state
  }
  async function snapshotFrom(tx:Transaction,history:History,deckId:string,base:number|null){
    const events=await tx.query<{payload:Contribution}>("SELECT payload FROM editing_contribution WHERE deck=$1 AND ($2::integer IS NULL OR (payload->>'seq')::integer>$2 OR (payload->>'toggledAt')::integer>$2) ORDER BY (payload->>'seq')::integer",[deckId,base])
    const runs=await tx.query<{payload:RunState}>("SELECT payload FROM editing_run WHERE deck=$1",[deckId])
    const receipts=await tx.query<{id:string}>("SELECT id FROM editing_receipt WHERE deck=$1 AND receipt->>'kind'='applied'",[deckId])
    history.events=events.rows.map(row=>row.payload)
    history.runs=runs.rows.map(row=>row.payload)
    return {deck:history.deck,seq:history.seq,contributions:{history,applied:receipts.rows.map(row=>commandId(row.id))}}
  }
  async function commit(tx:Transaction,principal:Principal,deckId:string,command:Command,identity:ExecutionIdentity,preparation?:{key:string;changes:(deck:Deck)=>ChangeSet},strictBase?:number,admitted?:History):Promise<{receipt:Receipt;history:History}>{
        const history = admitted ?? await owned(tx, principal, deckId)
        if(!executionMatches(command,identity))return {history,receipt:{id:command.id,seq:history.seq,kind:"refused",code:"execution-identity-mismatch",command}}
        const payload = createHash("sha256").update(canonical({command,identity,...(preparation ? {preparation:preparation.key} : {})})).digest("hex")
        const prior = await tx.query<{ payload: string; receipt: Receipt }>("SELECT payload,receipt FROM editing_receipt WHERE deck=$1 AND id=$2", [deckId, command.id])
        if (prior.rows[0]) {
          if (prior.rows[0].payload !== payload) throw new Error("request-id-payload-mismatch")
          return {history,receipt:prior.rows[0].receipt}
        }
        if(strictBase!==undefined && history.seq!==strictBase)return {history,receipt:{id:command.id,seq:history.seq,kind:"refused",code:"stale-base",command}}
        if (preparation) { if (command.kind !== "edit" || identity.kind !== "person") throw new Error("person-edit-required"); command = { ...command, base: history.seq, changes: preparation.changes(history.deck) } }
        if(!preparation)await loadHistoryIndex(tx,deckId,history,command)
        if(strictBase!==undefined && identity.kind==="run" && !history.runs.some(run=>run.id===identity.run))history.runs.push({id:identity.run,epoch:history.seq,kind:"open"})
        const result = execute(history, command, identity)
        if (result.receipt.kind === "applied" && identity.kind === "run" && !themeOnly(history.deck,result.history.deck) && (command.kind === "edit" || command.kind === "patch" || command.kind === "undo-change")) {
          const ledger = usageLedger(work => work(tx),clock)
          const admission = await ledger.reserve(principal.personId,{id:`${deckId}:${command.id}`,actor:identity.actor ?? "user-agent",request:JSON.stringify(command),units:1})
          if (admission.kind === "out-of-usage") return {history,receipt:{id:command.id,seq:history.seq,kind:"refused",code:"out-of-usage",command}}
          await ledger.settle(principal.personId,admission.reservation,"finished")
        }
        await tx.query("INSERT INTO editing_receipt(deck,id,payload,receipt) VALUES ($1,$2,$3,$4)", [deckId, command.id, payload, JSON.stringify(result.receipt)])
        if (result.receipt.kind === "applied") {
          await ownedDeckAssets(tx,principal,result.history.deck);await captureTemplateSources(tx,principal,result.history.deck)
          await saveHistoryIndex(tx,deckId,history,result.history)
          await tx.query("INSERT INTO editing_event(deck,seq,command,receipt) VALUES ($1,$2,$3,$4)", [deckId,result.history.seq,JSON.stringify(command),JSON.stringify(result.receipt)])
          if(!admitted)await tx.query("UPDATE editing_deck SET state=$2,updated_at=$3 WHERE id=$1", [deckId, JSON.stringify(currentProjection(result.history)),clock()])
        }
        return {history:result.history,receipt:result.receipt}
  }
  return {
    health: () => transaction(async tx => { await tx.query("SELECT 1") }),
    deletions:accountDeletionStore(transaction,clock),
    agents:agentStore(transaction,clock),
    files:ownedFiles(transaction),
    snapshots:toolSnapshots(transaction,clock),
    oauth:(secret:string,resource:string)=>oauthStore(transaction,secret,resource,clock),
    usage:usageLedger(transaction,clock),
    images:imageStore(transaction),
    templateSources:templateSources(transaction),
    catalog:createCatalog(transaction,clock),
    exports:exportStore(transaction,clock),
    async issueRunToken(principal: Principal, deckId: string, run: string) {
      return transaction(async tx=>{
        await owned(tx,principal,deckId)
        const found=await tx.query("SELECT id FROM editing_run WHERE deck=$1 AND id=$2",[deckId,run])
        if(!found.rows.length)throw new Error("run-not-found")
        const token=randomUUID()
        await tx.query("INSERT INTO editing_run_credential(token,deck,run) VALUES ($1,$2,$3)",[token,deckId,run])
        return token
      })
    },
    async runIdentity(principal: Principal, deckId: string, token: string): Promise<ExecutionIdentity> {
      return transaction(async tx=>{
        await owned(tx,principal,deckId)
        const found=await tx.query<{run:string}>("SELECT run FROM editing_run_credential WHERE token=$1 AND deck=$2",[token,deckId])
        const row=found.rows[0]
        if(!row)throw new Error("invalid-run-credential")
        return {kind:"run",run:row.run}
      })
    },
    async create(principal: Principal, deck: Deck) {
      return transaction(async tx => {
        await lockRetainedAccount(tx,principal.personId)
        await ownedDeckAssets(tx,principal,deck);await captureTemplateSources(tx,principal,deck)
        await tx.query("INSERT INTO editing_deck(id,owner,state) VALUES ($1,$2,$3)", [deck.id, principal.personId, JSON.stringify(initialHistory(deck))])
        return { deck, seq: 0 }
      })
    },
    async read(principal: Principal, deckId: string) { return transaction(async tx => {
      const history = await owned(tx, principal, deckId)
      const events=await tx.query<{payload:Contribution}>("SELECT payload FROM editing_contribution WHERE deck=$1 ORDER BY (payload->>'seq')::integer",[deckId])
      const runs=await tx.query<{payload:RunState}>("SELECT payload FROM editing_run WHERE deck=$1",[deckId])
      const receipts=await tx.query<{id:string}>("SELECT id FROM editing_receipt WHERE deck=$1 AND receipt->>'kind'='applied'",[deckId])
      history.events=events.rows.map(row=>row.payload)
      history.runs=runs.rows.map(row=>row.payload)
      return {deck:history.deck,seq:history.seq,contributions:{history,applied:receipts.rows.map(row=>commandId(row.id))}}
    }) },
    async delta(principal:Principal,deckId:string,base:number){return transaction(async tx=>{
      const history=await owned(tx,principal,deckId)
      if(!Number.isSafeInteger(base)||base<0||base>history.seq)throw new Error("invalid-delta-base")
      const events=await tx.query<{payload:Contribution}>("SELECT payload FROM editing_contribution WHERE deck=$1 AND ((payload->>'seq')::integer>$2 OR (payload->>'toggledAt')::integer>$2) ORDER BY (payload->>'seq')::integer",[deckId,base])
      const runs=await tx.query<{payload:RunState}>("SELECT payload FROM editing_run WHERE deck=$1",[deckId])
      const receipts=await tx.query<{id:string}>("SELECT id FROM editing_receipt WHERE deck=$1 AND receipt->>'kind'='applied'",[deckId])
      return {deck:history.deck,seq:history.seq,contributions:{history:{base,seq:history.seq,events:events.rows.map(row=>row.payload),runs:runs.rows.map(row=>row.payload),usedIds:history.usedIds},applied:receipts.rows.map(row=>commandId(row.id))}}
    })},
    async commit(principal: Principal, deckId: string, command: Command, identity: ExecutionIdentity = {kind:"person"}, preparation?: { key: string; changes: (deck: Deck) => ChangeSet }, strictBase?:number): Promise<Receipt> {
      return transaction(async tx=>(await commit(tx,principal,deckId,command,identity,preparation,strictBase)).receipt)
    },
    async commitSnapshot(principal:Principal,deckId:string,command:Command,identity:ExecutionIdentity,base:number|null){
      return transaction(async tx=>{
        const started=performance.now()
        const {receipt,history}=await commit(tx,principal,deckId,command,identity)
        const committed=performance.now()
        const snapshot=await snapshotFrom(tx,history,deckId,base)
        return {receipt,snapshot,...(process.env.AIRDESIGN_SYNC_PROFILE==="1" ? {profile:{commitMs:committed-started,checkpointMs:performance.now()-committed}} : {})}
      })
    },
    async commitBatchSnapshot(principal:Principal,deckId:string,commands:Command[],identity:ExecutionIdentity,base:number|null){
      if(commands.length===0 || commands.length>100)throw new Error("invalid-command-batch")
      return transaction(async tx=>{
        const started=performance.now(),receipts:Receipt[]=[],results:({kind:"receipt";receipt:Receipt}|{kind:"error";code:string})[]=[],commandMs:number[]=[]
        let history=await owned(tx,principal,deckId)
        for(const command of commands){
          const start=performance.now()
          await tx.query("SAVEPOINT batch_command")
          try {
            const result=await commit(tx,principal,deckId,command,identity,undefined,undefined,currentProjection(history))
            receipts.push(result.receipt);results.push({kind:"receipt",receipt:result.receipt});history=result.history
          } catch(error) {
            if(!(error instanceof Error) || error.message!=="request-id-payload-mismatch")throw error
            await tx.query("ROLLBACK TO SAVEPOINT batch_command")
            results.push({kind:"error",code:error.message})
          }
          await tx.query("RELEASE SAVEPOINT batch_command")
          commandMs.push(performance.now()-start)
        }
        await tx.query("UPDATE editing_deck SET state=$2,updated_at=$3 WHERE id=$1",[deckId,JSON.stringify(currentProjection(history)),clock()])
        const committed=performance.now()
        const snapshot=await snapshotFrom(tx,history,deckId,base)
        return {receipts,results,snapshot,...(process.env.AIRDESIGN_SYNC_PROFILE==="1" ? {profile:{commitMs:committed-started,commandMs,checkpointMs:performance.now()-committed}} : {})}
      })
    },
    async replay(principal: Principal, deckId: string, after: number) {
      return transaction(async tx => {
        const history = await owned(tx, principal, deckId)
        const result = await tx.query<{ seq: number; command: Command; receipt: Receipt }>("SELECT seq,command,receipt FROM editing_event WHERE deck=$1 AND seq>$2 ORDER BY seq LIMIT 100", [deckId, after])
        return { head: history.seq, events: result.rows }
      })
    },
    async delete(principal: Principal, deckId: string) { return transaction(async tx => { await owned(tx, principal, deckId); await tx.query("UPDATE editing_deck SET deleted=true,deleted_at=$2 WHERE id=$1", [deckId,clock()]) }) },
    async close() { if (closed) return;closed=true;await local?.close();await pool?.end();await Promise.all(connections) },
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

function themeOnly(before:Deck,after:Deck):boolean{
  const withoutThemes=(deck:Deck)=>JSON.stringify(deck,(key,value)=>["themes","theme","version"].includes(key) ? undefined : value)
  const withThemes=(deck:Deck)=>canonical(JSON.parse(JSON.stringify(deck,(key,value)=>key==="version" ? undefined : value)))
  return withThemes(before)!==withThemes(after) && canonical(JSON.parse(withoutThemes(before)))===canonical(JSON.parse(withoutThemes(after)))
}

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
export async function createHistoryStore(driver: { kind: "pglite"; path?: string } | { kind: "postgres"; url: string }, clock=Date.now) {
  if (driver.kind === "pglite" && driver.path) await mkdir(driver.path, { recursive: true })
  const local = driver.kind === "pglite" ? new PGlite(driver.path) : null
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
    await tx.query("CREATE TABLE IF NOT EXISTS editing_run_credential (token text PRIMARY KEY, deck text NOT NULL REFERENCES editing_deck(id), run text NOT NULL)")
    await initializeHistoryIndex(tx); await initializeCatalog(tx);await initializeExports(tx) })
  async function owned(tx: Transaction, principal: Principal, deckId: string) {
    const result = await tx.query<{ state: History; deleted: boolean }>("SELECT state, deleted FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE", [deckId, principal.personId])
    const row = result.rows[0]
    if (!row) throw new Error("deck-not-found")
    if (row.deleted) throw new Error("deck-deleted")
    return row.state
  }
  return {
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
    async commit(principal: Principal, deckId: string, command: Command, identity: ExecutionIdentity = {kind:"person"}, preparation?: { key: string; changes: (deck: Deck) => ChangeSet }): Promise<Receipt> {
      return transaction(async tx => {
        const history = await owned(tx, principal, deckId)
        if(!executionMatches(command,identity))return {id:command.id,seq:history.seq,kind:"refused",code:"execution-identity-mismatch",command}
        const payload = createHash("sha256").update(canonical({command,identity,...(preparation ? {preparation:preparation.key} : {})})).digest("hex")
        const prior = await tx.query<{ payload: string; receipt: Receipt }>("SELECT payload,receipt FROM editing_receipt WHERE deck=$1 AND id=$2", [deckId, command.id])
        if (prior.rows[0]) {
          if (prior.rows[0].payload !== payload) throw new Error("request-id-payload-mismatch")
          return prior.rows[0].receipt
        }
        if (preparation) { if (command.kind !== "edit" || identity.kind !== "person") throw new Error("person-edit-required"); command = { ...command, base: history.seq, changes: preparation.changes(history.deck) } }
        await loadHistoryIndex(tx,deckId,history,command)
        const result = execute(history, command, identity)
        await tx.query("INSERT INTO editing_receipt(deck,id,payload,receipt) VALUES ($1,$2,$3,$4)", [deckId, command.id, payload, JSON.stringify(result.receipt)])
        if (result.receipt.kind === "applied") {
          await saveHistoryIndex(tx,deckId,history,result.history)
          await tx.query("INSERT INTO editing_event(deck,seq,command,receipt) VALUES ($1,$2,$3,$4)", [deckId,result.history.seq,JSON.stringify(command),JSON.stringify(result.receipt)])
          await tx.query("UPDATE editing_deck SET state=$2,updated_at=$3 WHERE id=$1", [deckId, JSON.stringify(currentProjection(result.history)),clock()])
        }
        return result.receipt
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

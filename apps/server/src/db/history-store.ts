import { PGlite } from "@electric-sql/pglite"
import pg from "pg"
import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { execute, initialHistory, type Command, type History, type Principal, type Receipt } from "../../../../packages/change-log/src/index.ts"
import type { Deck } from "../../../../packages/deck/src/index.ts"
import { currentProjection, initializeHistoryIndex, loadHistoryIndex, saveHistoryIndex } from "./history-index.ts"

type Transaction = Pick<PGlite, "query">
export type HistoryStore = Awaited<ReturnType<typeof createHistoryStore>>
export async function createHistoryStore(driver: { kind: "pglite"; path?: string } | { kind: "postgres"; url: string }) {
  if (driver.kind === "pglite" && driver.path) await mkdir(driver.path, { recursive: true })
  const local = driver.kind === "pglite" ? new PGlite(driver.path) : null
  const postgresUrl = driver.kind === "postgres" ? driver.url : null
  async function transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    if (local) return local.transaction(work)
    if (!postgresUrl) throw new Error("database-closed")
    const client = new pg.Client({ connectionString: postgresUrl })
    await client.connect()
    try {
      await client.query("BEGIN")
      const tx: Transaction = { query: async <R>(sql: string, params?: unknown[]) => {
        const result = await client.query(sql, params)
        return { rows: result.rows.map(row => row as R), affectedRows: result.rowCount ?? 0, fields: [] }
      } }
      const result = await work(tx)
      await client.query("COMMIT")
      return result
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { await client.end() }
  }
  await transaction(async tx => { await tx.query("CREATE TABLE IF NOT EXISTS editing_deck (id text PRIMARY KEY, owner text NOT NULL, state jsonb NOT NULL, deleted boolean NOT NULL DEFAULT false)")
    await tx.query("CREATE TABLE IF NOT EXISTS editing_receipt (deck text NOT NULL REFERENCES editing_deck(id), id text NOT NULL, payload text NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY(deck,id))")
    await tx.query("CREATE TABLE IF NOT EXISTS editing_event (deck text NOT NULL REFERENCES editing_deck(id), seq integer NOT NULL, command jsonb NOT NULL, receipt jsonb NOT NULL, PRIMARY KEY(deck,seq))")
    await initializeHistoryIndex(tx) })
  async function owned(tx: Transaction, principal: Principal, deckId: string) {
    const result = await tx.query<{ state: History; deleted: boolean }>("SELECT state, deleted FROM editing_deck WHERE id=$1 AND owner=$2 FOR UPDATE", [deckId, principal.personId])
    const row = result.rows[0]
    if (!row) throw new Error("deck-not-found")
    if (row.deleted) throw new Error("deck-deleted")
    return row.state
  }
  return {
    async create(principal: Principal, deck: Deck) {
      return transaction(async tx => {
        await tx.query("INSERT INTO editing_deck(id,owner,state) VALUES ($1,$2,$3)", [deck.id, principal.personId, JSON.stringify(initialHistory(deck))])
        return { deck, seq: 0 }
      })
    },
    async read(principal: Principal, deckId: string) { return transaction(async tx => { const history = await owned(tx, principal, deckId); return { deck: history.deck, seq: history.seq } }) },
    async commit(principal: Principal, deckId: string, command: Command): Promise<Receipt> {
      return transaction(async tx => {
        const history = await owned(tx, principal, deckId)
        const payload = createHash("sha256").update(canonical(command)).digest("hex")
        const prior = await tx.query<{ payload: string; receipt: Receipt }>("SELECT payload,receipt FROM editing_receipt WHERE deck=$1 AND id=$2", [deckId, command.id])
        if (prior.rows[0]) {
          if (prior.rows[0].payload !== payload) throw new Error("request-id-payload-mismatch")
          return prior.rows[0].receipt
        }
        await loadHistoryIndex(tx,deckId,history,command)
        const result = execute(history, command)
        await tx.query("INSERT INTO editing_receipt(deck,id,payload,receipt) VALUES ($1,$2,$3,$4)", [deckId, command.id, payload, JSON.stringify(result.receipt)])
        if (result.receipt.kind === "applied") {
          await saveHistoryIndex(tx,deckId,history,result.history)
          await tx.query("INSERT INTO editing_event(deck,seq,command,receipt) VALUES ($1,$2,$3,$4)", [deckId,result.history.seq,JSON.stringify(command),JSON.stringify(result.receipt)])
          await tx.query("UPDATE editing_deck SET state=$2 WHERE id=$1", [deckId, JSON.stringify(currentProjection(result.history))])
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
    async delete(principal: Principal, deckId: string) { return transaction(async tx => { await owned(tx, principal, deckId); await tx.query("UPDATE editing_deck SET deleted=true WHERE id=$1", [deckId]) }) },
    async close() { await local?.close();  },
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`
  return JSON.stringify(value) ?? "null"
}

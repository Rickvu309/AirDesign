import type { DeckId, WireEdit, WireSlide } from "@airdesign/catalog"
import { bytesOf, limits, storedValue } from "@airdesign/document"
import type { PendingRow } from "./store.js"

const longestOnce = "o".repeat(64)

export function wireOf(row: PendingRow): WireEdit | WireSlide {
  const edit = row.slideEdit
  if (edit !== undefined && row.slideFile !== undefined) return { ...edit, file: row.slideFile }
  if (row.node === undefined) throw new Error("missing node")
  if (row.floor === undefined) return { ...storedValue(row), node: row.node }
  return { ...storedValue(row), node: row.node, floor: row.floor }
}

function emptyBytes(deck: DeckId, once: string): number {
  return bytesOf(JSON.stringify({ deck, batch: [], once }))
}

function wireBytes(row: PendingRow): number {
  return bytesOf(JSON.stringify(wireOf(row)))
}

export function bodyBytes(deck: DeckId, rows: readonly PendingRow[], once: string): number {
  return bytesOf(JSON.stringify({ deck, batch: rows.map(wireOf), once }))
}

export function fitsAlone(deck: DeckId, row: PendingRow): boolean {
  return emptyBytes(deck, longestOnce) + wireBytes(row) <= limits.body
}

export function nextBatch(deck: DeckId, rows: readonly PendingRow[], once: string): PendingRow[] {
  const first = rows[0]
  const batch: PendingRow[] = []
  let bytes = emptyBytes(deck, once) - 1
  for (const row of rows.slice(0, limits.batch)) {
    if (first === undefined || row.once !== first.once) break
    bytes += wireBytes(row) + 1
    if (first.once === undefined && batch.length > 0 && bytes > limits.body) break
    batch.push(row)
  }
  return batch
}

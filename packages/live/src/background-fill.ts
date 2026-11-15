import { format, readRow, readSlideId, slideNode, type ElementId, type Row } from "@airdesign/document"

import { confirmedRow, pendingRow, type StoredRow } from "./store.js"

export function backgroundFill(raw: unknown): { readonly node: ElementId; readonly row: Row } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const edit = raw as Record<string, unknown>
  const id = readSlideId(edit.id)
  if (edit.slide !== "background" || id === undefined) return undefined
  const value = edit.color === null ? "opening" : { set: { solid: edit.color } }
  const read = readRow({ v: format, patch: { fill: { value } } }, "text")
  return read.ok ? { node: slideNode(id, "slide"), row: read.value } : undefined
}

export function filledRow(row: StoredRow): StoredRow {
  const fill = backgroundFill(row.slideEdit)
  if (fill === undefined) return row
  if (row.kind === "confirmed") return confirmedRow(row.deck, row.revision, fill.row, fill.node)
  const pending = pendingRow(row.deck, row.order, row.base, fill.row, fill.node, "")
  return row.once === undefined ? pending : { ...pending, once: row.once }
}

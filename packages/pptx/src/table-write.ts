import { tableColumns, type TableValue, type TextValue } from "@airdesign/document"
import { spliceBytes, type MarkupElement } from "./element-span.js"
import { partBytes } from "./part-markup.js"
import { applyStructuralRoute } from "./structural-route.js"
import { themeSlot, type ThemeSlot } from "./cell-text.js"
import { cellEdits, cellRead, type CellRead } from "./table-cells.js"
import { slidePalette } from "./trait-read.js"
import { cellsOf, gridOf, type Grid } from "./table-grid.js"
import { shapeTextValue, textValueEdits } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

function cellValue(grid: Grid, bytes: Uint8Array, cell: MarkupElement): TextValue {
  const value = shapeTextValue(grid.children, bytes, cell)
  return value.length === 0 ? [{ from: 0, runs: [] }] : value
}

export function readTable(parts: Parts, part: string, shape: string): TableValue | null {
  const bytes = partBytes(parts, part)
  const grid = gridOf(bytes, shape)
  if (grid.merged || grid.rows.length === 0 || grid.columns === 0) return null
  return {
    rows: grid.rows.map((row, from) => ({
      from,
      cells: cellsOf(grid, row).map((cell) => cellValue(grid, bytes, cell)),
    })),
  }
}

export function readCells(parts: Parts, part: string, shape: string): readonly (readonly CellRead[])[] {
  const grid = gridOf(partBytes(parts, part), shape)
  return grid.rows.map((row) => cellsOf(grid, row).map((cell) => cellRead(grid, cell)))
}

function sameText(left: TextValue, right: TextValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sourceChanges(sources: readonly number[], count: number, add: (at: number, first: boolean) => void): void {
  const shown: (number | null)[] = Array.from({ length: count }, (_, from) => from)
  let at = 0
  let first = true
  for (const from of sources) {
    if (from >= 0) {
      at = shown.indexOf(from) + 1
      first = false
      continue
    }
    add(at, first)
    shown.splice(at, 0, null)
    at += 1
    first = false
  }
  const kept = new Set(sources)
  for (let index = shown.length - 1; index >= 0; index -= 1) {
    const from = shown[index]
    if (from !== null && from !== undefined && !kept.has(from)) add(-(index + 1), false)
  }
}

export function writeTable(parts: Parts, part: string, shape: string, value: TableValue): Parts {
  const start = gridOf(partBytes(parts, part), shape)
  if (start.merged) throw new Error("tbl.merged")
  const columns = tableColumns(value)
  if (
    columns.some((from) => from >= start.columns) ||
    value.rows.some((row) => row.from >= start.rows.length || row.cells.length !== columns.length)
  )
    throw new Error("a:tbl")
  let next = parts
  sourceChanges(columns, start.columns, (at, first) => {
    const edit =
      at < 0
        ? ({ name: "tbl.removeColumn", part, shape, column: -at } as const)
        : ({ name: "tbl.addColumn", part, shape, column: first ? 1 : at, place: first ? "before" : "after" } as const)
    next = applyStructuralRoute(next, edit)
  })
  sourceChanges(
    value.rows.map((row) => row.from),
    start.rows.length,
    (at, first) => {
      const row = start.offset + (at < 0 ? -at : first ? at + 1 : at)
      next = applyStructuralRoute(next, { name: at < 0 ? "tbl.removeRow" : "tbl.addRow", part, row })
      if (at >= 0 && first) next = applyStructuralRoute(next, { name: "tbl.orderRow", part, row: row + 1, before: row })
    },
  )
  const bytes = partBytes(next, part)
  const grid = gridOf(bytes, shape)
  const edits = grid.rows.flatMap((row, at) =>
    cellsOf(grid, row).flatMap((cell, column) => {
      const wanted = value.rows[at]?.cells[column]
      if (wanted === undefined) throw new Error("a:tc")
      return sameText(cellValue(grid, bytes, cell), wanted) ? [] : textValueEdits(grid.children, bytes, cell, wanted)
    }),
  )
  const typed = edits.length === 0 ? bytes : spliceBytes(bytes, edits)
  let slots: ThemeSlot | null | undefined
  const theme = () => {
    if (slots === undefined) {
      const palette = slidePalette(next, part)
      slots = palette === null ? null : themeSlot(palette)
    }
    return slots
  }
  const formatted = cellEdits(edits.length === 0 ? grid : gridOf(typed, shape), typed, value.rows, theme)
  if (edits.length === 0 && formatted === null) return next
  const written = new Map(next)
  written.set(part, formatted ?? typed)
  return written
}

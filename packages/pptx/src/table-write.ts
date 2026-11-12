import type { TableValue, TextValue } from "@airdesign/document"
import { spliceBytes, type MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { partBytes, requireMarkup, within } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { applyStructuralRoute } from "./structural-route.js"
import { markupChildren, shapeTextValue, textValueEdits, type MarkupChildren } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>

type Grid = {
  readonly children: MarkupChildren
  readonly offset: number
  readonly columns: number
  readonly rows: readonly MarkupElement[]
  readonly merged: boolean
}

const mergeNames = ["gridSpan", "rowSpan", "hMerge", "vMerge"]

function owned(children: MarkupChildren, parent: MarkupElement | undefined, kind: string): readonly MarkupElement[] {
  return parent === undefined ? [] : (children[parent.index] ?? []).filter((element) => element.kind === kind)
}

function gridOf(bytes: Uint8Array, shape: string): Grid {
  const { elements } = requireMarkup(bytes)
  const frame = shapeById(elements, shape)
  const table = elements.find((element) => element.kind === "a:tbl" && within(elements, element, frame))
  if (frame.kind !== "p:graphicFrame" || table === undefined) throw new Error("a:tbl")
  const children = markupChildren(elements)
  const rows = owned(children, table, "a:tr")
  const columns = owned(children, owned(children, table, "a:tblGrid")[0], "a:gridCol").length
  const merged = rows.some((row) => {
    const cells = owned(children, row, "a:tc")
    return (
      cells.length !== columns || cells.some((cell) => mergeNames.some((name) => paintAttribute(cell, name) !== null))
    )
  })
  const first = rows[0]
  const offset =
    first === undefined
      ? 0
      : elements.filter((element) => element.kind === "a:tr" && element.start < first.start).length
  return { children, offset, columns, rows, merged }
}

function cellsOf(grid: Grid, row: MarkupElement): readonly MarkupElement[] {
  return owned(grid.children, row, "a:tc")
}

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

function sameText(left: TextValue, right: TextValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function writeTable(parts: Parts, part: string, shape: string, value: TableValue): Parts {
  const start = gridOf(partBytes(parts, part), shape)
  if (start.merged) throw new Error("tbl.merged")
  if (value.rows.some((row) => row.from >= start.rows.length || row.cells.length !== start.columns))
    throw new Error("a:tbl")
  let next = parts
  const route = (name: "tbl.addRow" | "tbl.removeRow", row: number) => {
    next = applyStructuralRoute(next, { name, part, row: start.offset + row })
  }
  const shown: (number | null)[] = start.rows.map((_, from) => from)
  let at = 0
  let placed = false
  for (const row of value.rows) {
    if (row.from >= 0) {
      at = shown.indexOf(row.from) + 1
      placed = true
      continue
    }
    route("tbl.addRow", placed ? at : at + 1)
    if (!placed)
      next = applyStructuralRoute(next, {
        name: "tbl.orderRow",
        part,
        row: start.offset + at + 2,
        before: start.offset + at + 1,
      })
    shown.splice(at, 0, null)
    at += 1
    placed = true
  }
  const kept = new Set(value.rows.map((row) => row.from))
  for (let index = shown.length - 1; index >= 0; index -= 1) {
    const from = shown[index]
    if (from !== null && from !== undefined && !kept.has(from)) route("tbl.removeRow", index + 1)
  }
  const bytes = partBytes(next, part)
  const grid = gridOf(bytes, shape)
  const edits = grid.rows.flatMap((row, at) =>
    cellsOf(grid, row).flatMap((cell, column) => {
      const wanted = value.rows[at]?.cells[column]
      if (wanted === undefined) throw new Error("a:tc")
      return sameText(cellValue(grid, bytes, cell), wanted) ? [] : textValueEdits(grid.children, bytes, cell, wanted)
    }),
  )
  if (edits.length === 0) return next
  const written = new Map(next)
  written.set(part, spliceBytes(bytes, edits))
  return written
}

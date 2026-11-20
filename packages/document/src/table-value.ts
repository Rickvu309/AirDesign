import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import {
  borderSpots,
  heldCells,
  inRange,
  readBorders,
  readCellFill,
  readCellList,
  type Border,
  type Borders,
  type BorderSides,
  type CellFill,
  type CellRange,
} from "./table-cells.js"
import { droppedSize, placedSize, readSize, readSizes } from "./table-sizes.js"
import { styledCell, type CellStyle } from "./table-style.js"
import { readParagraphs, type TextValue } from "./text-value.js"

export type TableRow = {
  readonly from: number
  readonly cells: readonly TextValue[]
  readonly fills?: readonly (CellFill | null)[]
  readonly borders?: readonly (Borders | null)[]
  readonly height?: number
}
export type TableValue = {
  readonly rows: readonly TableRow[]
  readonly columns?: readonly number[]
  readonly widths?: readonly number[]
}

export type TableChange =
  | { readonly change: "cell"; readonly row: number; readonly column: number; readonly text: string }
  | { readonly change: "row"; readonly row: number; readonly place: "above" | "below" }
  | { readonly change: "remove-row"; readonly row: number }
  | { readonly change: "column"; readonly column: number; readonly place: "before" | "after" }
  | { readonly change: "remove-column"; readonly column: number }
  | { readonly change: "fill"; readonly cells: CellRange; readonly fill: CellFill }
  | { readonly change: "border"; readonly cells: CellRange; readonly sides: BorderSides; readonly border: Border }
  | { readonly change: "widths"; readonly widths: readonly number[] }
  | { readonly change: "style"; readonly cells: CellRange; readonly style: CellStyle }
  | { readonly change: "heights"; readonly heights: readonly number[] }

const emptyCell: TextValue = [{ from: 0, runs: [] }]

const rowKeys = ["from", "cells", "fills", "borders", "height"]

function readRow(raw: unknown): TableRow | null {
  const row = record(raw)
  const keys = row === null ? [] : rowKeys.filter((key) => Object.hasOwn(row, key))
  if (row === null || !onlyKeys(row, keys) || !keys.includes("from") || !Array.isArray(row.cells)) return null
  const from = row.from
  if (typeof from !== "number" || !Number.isSafeInteger(from) || from < -1) return null
  if (row.cells.length < 1 || row.cells.length > limits.tableColumns) return null
  const cells: TextValue[] = []
  for (const raw of row.cells) {
    const cell = readParagraphs(raw)
    if (cell === null) return null
    cells.push(cell)
  }
  const fills = row.fills === undefined ? undefined : readCellList(row.fills, cells.length, readCellFill)
  const borders = row.borders === undefined ? undefined : readCellList(row.borders, cells.length, readBorders)
  const height = readSize(row.height)
  if (fills === null || borders === null || height === null) return null
  return {
    from,
    cells,
    ...(fills === undefined ? {} : { fills }),
    ...(borders === undefined ? {} : { borders }),
    ...(height === undefined ? {} : { height }),
  }
}

function writtenRow(row: TableRow): TableRow {
  const fills = heldCells(row.fills)
  const borders = heldCells(row.borders)
  return {
    from: row.from,
    cells: row.cells,
    ...(fills === undefined ? {} : { fills }),
    ...(borders === undefined ? {} : { borders }),
    ...(row.height === undefined ? {} : { height: row.height }),
  }
}

function withCells(row: TableRow, change: <T>(items: readonly T[], blank: T) => readonly T[]): TableRow {
  const fills = row.fills === undefined ? undefined : change(row.fills, null)
  const borders = row.borders === undefined ? undefined : change(row.borders, null)
  return writtenRow({
    ...row,
    cells: change(row.cells, emptyCell),
    ...(fills === undefined ? {} : { fills }),
    ...(borders === undefined ? {} : { borders }),
  })
}

function sources(raw: unknown, count: number): readonly number[] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null
  const columns: number[] = []
  let last = -1
  for (const from of raw) {
    if (typeof from !== "number" || !Number.isSafeInteger(from) || from < -1) return null
    if (from >= 0 && from <= last) return null
    if (from >= 0) last = from
    columns.push(from)
  }
  return columns
}

export function tableColumns(value: TableValue): readonly number[] {
  return value.columns ?? (value.rows[0]?.cells ?? []).map((_, at) => at)
}

function tableOf(
  rows: readonly TableRow[],
  columns: readonly number[],
  widths: readonly number[] | undefined,
): TableValue {
  const sized = widths === undefined ? {} : { widths }
  return columns.every((from, at) => from === at) ? { rows, ...sized } : { rows, columns, ...sized }
}

export function readTableValue(value: string): TableValue | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  const table = record(parsed)
  const keys = ["rows", "columns", "widths"].filter((key) => key === "rows" || (table !== null && key in table))
  if (table === null || !onlyKeys(table, keys) || !Array.isArray(table.rows)) return null
  if (table.rows.length < 1 || table.rows.length > limits.tableRows) return null
  const rows: TableRow[] = []
  let last = -1
  for (const raw of table.rows) {
    const row = readRow(raw)
    if (row === null || row.cells.length !== (rows[0]?.cells.length ?? row.cells.length)) return null
    if (row.from >= 0) {
      if (row.from <= last) return null
      last = row.from
    }
    rows.push(row)
  }
  const count = rows[0]?.cells.length ?? 0
  const widths = table.widths === undefined ? undefined : readSizes(table.widths, count)
  const columns = table.columns === undefined ? rows[0]?.cells.map((_, at) => at) : sources(table.columns, count)
  return columns === null || columns === undefined || widths === null ? null : tableOf(rows, columns, widths)
}

export function writeTableValue(value: TableValue): string {
  return JSON.stringify(tableOf(value.rows.map(writtenRow), tableColumns(value), value.widths))
}

const openingRowHeight = 370_840
const openingWidthShare = 0.6

export function openingTableSize(slideWidth: number, rows: number): { readonly cx: number; readonly cy: number } {
  return { cx: Math.round(slideWidth * openingWidthShare), cy: rows * openingRowHeight }
}

export function openingTable(rows: number, columns: number): TableValue {
  return {
    rows: Array.from({ length: rows }, (_, from) => ({
      from,
      cells: Array.from({ length: columns }, () => emptyCell),
    })),
  }
}

export function cellText(cell: TextValue): string {
  return cell.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function typedCell(cell: TextValue, text: string): TextValue {
  return text.split("\n").map((line, at) => {
    const source = cell[Math.min(at, cell.length - 1)]
    const kept = source?.runs.length === 1 && at < cell.length ? source.runs[0] : undefined
    const run = kept === undefined ? { from: -1, text: line } : { ...kept, text: line }
    return { from: source?.from ?? 0, runs: line === "" ? [] : [run] }
  })
}

function cellCount(value: TableValue): number {
  return value.rows[0]?.cells.length ?? 0
}

function heldOr<T>(row: TableRow, items: readonly (T | null)[] | undefined): (T | null)[] {
  return items === undefined ? row.cells.map(() => null) : [...items]
}

function changedCells(
  value: TableValue,
  change: Extract<TableChange, { readonly change: "fill" | "border" }>,
): TableValue | null {
  if (!inRange(change.cells, value.rows.length, cellCount(value))) return null
  const rows = value.rows.map((row) => ({ ...row, fills: heldOr(row, row.fills), borders: heldOr(row, row.borders) }))
  if (change.change === "fill") {
    const [top, bottom] = change.cells.rows
    const [left, right] = change.cells.columns
    for (let row = top; row <= bottom; row += 1)
      for (let column = left; column <= right; column += 1) {
        const fills = rows[row]?.fills
        if (fills !== undefined) fills[column] = change.fill
      }
  } else
    for (const spot of borderSpots(change.cells, change.sides, value.rows.length, cellCount(value))) {
      const borders = rows[spot.row]?.borders
      if (borders === undefined) continue
      const held = borders[spot.column] ?? {}
      borders[spot.column] = { ...held, [spot.side]: { ...held[spot.side], ...change.border } }
    }
  const next = tableOf(rows.map(writtenRow), tableColumns(value), value.widths)
  return writeTableValue(next) === writeTableValue(value) ? value : next
}

function changedColumns(
  value: TableValue,
  change: Extract<TableChange, { readonly change: "column" | "remove-column" }>,
): TableValue | null {
  const columns = tableColumns(value)
  if (!Number.isInteger(change.column) || change.column < 0 || change.column >= columns.length) return null
  if (change.change === "remove-column") {
    if (columns.length < 2) return null
    const kept = (_: unknown, at: number) => at !== change.column
    return tableOf(
      value.rows.map((row) => withCells(row, (items) => items.filter(kept))),
      columns.filter(kept),
      droppedSize(value.widths, change.column),
    )
  }
  if (columns.length >= limits.tableColumns) return null
  const at = change.place === "before" ? change.column : change.column + 1
  const placed = <Item>(items: readonly Item[], item: Item) => [...items.slice(0, at), item, ...items.slice(at)]
  return tableOf(
    value.rows.map((row) => withCells(row, placed)),
    placed(columns, -1),
    placedSize(value.widths, at, change.column),
  )
}

function styled(value: TableValue, change: Extract<TableChange, { readonly change: "style" }>): TableValue | null {
  if (!inRange(change.cells, value.rows.length, cellCount(value))) return null
  const [top, bottom] = change.cells.rows
  const [left, right] = change.cells.columns
  const rows = value.rows.map((row, at) =>
    at < top || at > bottom
      ? row
      : {
          ...row,
          cells: row.cells.map((cell, column) =>
            column < left || column > right ? cell : styledCell(cell, change.style),
          ),
        },
  )
  const next = tableOf(rows, tableColumns(value), value.widths)
  return writeTableValue(next) === writeTableValue(value) ? value : next
}

function resized(value: TableValue, change: Extract<TableChange, { readonly change: "widths" | "heights" }>) {
  if (change.change === "widths") {
    const widths = readSizes(change.widths, cellCount(value))
    if (widths === null) return null
    const same = JSON.stringify(widths) === JSON.stringify(value.widths)
    return same ? value : tableOf(value.rows, tableColumns(value), widths)
  }
  const heights = readSizes(change.heights, value.rows.length)
  if (heights === null) return null
  if (value.rows.every((row, at) => row.height === heights[at])) return value
  const rows = value.rows.map((row, at) => ({ ...row, height: heights[at] ?? 0 }))
  return tableOf(rows, tableColumns(value), value.widths)
}

export function changedTable(value: TableValue, change: TableChange): TableValue | null {
  if (change.change === "column" || change.change === "remove-column") return changedColumns(value, change)
  if (change.change === "fill" || change.change === "border") return changedCells(value, change)
  if (change.change === "widths" || change.change === "heights") return resized(value, change)
  if (change.change === "style") return styled(value, change)
  const row = value.rows[change.row]
  if (row === undefined) return null
  if (change.change === "cell") {
    const cell = row.cells[change.column]
    if (cell === undefined) return null
    if (cellText(cell) === change.text) return value
    const cells = row.cells.map((each, at) => (at === change.column ? typedCell(each, change.text) : each))
    return tableOf(
      value.rows.map((each, at) => (at === change.row ? { ...each, cells } : each)),
      tableColumns(value),
      value.widths,
    )
  }
  if (change.change === "remove-row") {
    if (value.rows.length < 2) return null
    return tableOf(
      value.rows.filter((_, at) => at !== change.row),
      tableColumns(value),
      value.widths,
    )
  }
  if (value.rows.length >= limits.tableRows) return null
  const at = change.place === "above" ? change.row : change.row + 1
  const added = {
    from: -1,
    cells: row.cells.map(() => emptyCell),
    ...(row.height === undefined ? {} : { height: row.height }),
  }
  return tableOf([...value.rows.slice(0, at), added, ...value.rows.slice(at)], tableColumns(value), value.widths)
}

export function openedTable(value: string | null): boolean {
  const table = value === null ? null : readTableValue(value)
  return (
    table !== null && table.rows.every((row, at) => row.from === at && row.cells.every((cell) => cellText(cell) === ""))
  )
}

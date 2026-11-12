import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { readParagraphs, type TextValue } from "./text-value.js"

export type TableRow = { readonly from: number; readonly cells: readonly TextValue[] }
export type TableValue = { readonly rows: readonly TableRow[] }

export type TableChange =
  | { readonly change: "cell"; readonly row: number; readonly column: number; readonly text: string }
  | { readonly change: "row"; readonly row: number; readonly place: "above" | "below" }
  | { readonly change: "remove-row"; readonly row: number }

const emptyCell: TextValue = [{ from: 0, runs: [] }]

function readRow(raw: unknown): TableRow | null {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["from", "cells"]) || !Array.isArray(row.cells)) return null
  const from = row.from
  if (typeof from !== "number" || !Number.isSafeInteger(from) || from < -1) return null
  if (row.cells.length < 1 || row.cells.length > limits.tableColumns) return null
  const cells: TextValue[] = []
  for (const raw of row.cells) {
    const cell = readParagraphs(raw)
    if (cell === null) return null
    cells.push(cell)
  }
  return { from, cells }
}

export function readTableValue(value: string): TableValue | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  const table = record(parsed)
  if (table === null || !onlyKeys(table, ["rows"]) || !Array.isArray(table.rows)) return null
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
  return { rows }
}

export function writeTableValue(value: TableValue): string {
  return JSON.stringify({ rows: value.rows.map((row) => ({ from: row.from, cells: row.cells })) })
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
    const run = source?.runs.length === 1 && at < cell.length ? (source.runs[0]?.from ?? -1) : -1
    return { from: source?.from ?? 0, runs: line === "" ? [] : [{ from: run, text: line }] }
  })
}

export function changedTable(value: TableValue, change: TableChange): TableValue | null {
  const row = value.rows[change.row]
  if (row === undefined) return null
  if (change.change === "cell") {
    const cell = row.cells[change.column]
    if (cell === undefined) return null
    if (cellText(cell) === change.text) return value
    const cells = row.cells.map((each, at) => (at === change.column ? typedCell(each, change.text) : each))
    return { rows: value.rows.map((each, at) => (at === change.row ? { from: each.from, cells } : each)) }
  }
  if (change.change === "remove-row") {
    if (value.rows.length < 2) return null
    return { rows: value.rows.filter((_, at) => at !== change.row) }
  }
  if (value.rows.length >= limits.tableRows) return null
  const at = change.place === "above" ? change.row : change.row + 1
  const added = { from: -1, cells: row.cells.map(() => emptyCell) }
  return { rows: [...value.rows.slice(0, at), added, ...value.rows.slice(at)] }
}

export function openedTable(value: string | null): boolean {
  const table = value === null ? null : readTableValue(value)
  return (
    table !== null && table.rows.every((row, at) => row.from === at && row.cells.every((cell) => cellText(cell) === ""))
  )
}

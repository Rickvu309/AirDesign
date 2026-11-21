import { readTableValue, writeTableValue } from "./table-value.js"
import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

function inPlaces(value: TextValue): boolean {
  return value.every((paragraph) => paragraph.from === 0 && paragraph.runs.every((run) => run.from === -1))
}

function placed(value: TextValue): TextValue {
  return value.map((paragraph) => ({
    ...paragraph,
    from: 0,
    runs: paragraph.runs.map((run) => ({ ...run, from: -1 })),
  }))
}

export function placedText(stored: string): string {
  const read = readTextValue(stored)
  return read === null || inPlaces(read) ? stored : writeTextValue(placed(read))
}

export function placedTable(stored: string): string {
  const table = readTableValue(stored)
  if (table === null || table.rows.every((row) => row.cells.every(inPlaces))) return stored
  return writeTableValue({ ...table, rows: table.rows.map((row) => ({ ...row, cells: row.cells.map(placed) })) })
}

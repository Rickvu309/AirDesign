import type { WireChange } from "@airdesign/catalog"
import {
  readTableValue,
  readTextValue,
  slideKind,
  tableColumns,
  type ElementId,
  type TableValue,
  type TextRun,
  type TextValue,
} from "@airdesign/document"

export type TextProblem = { readonly code: "field" | "text-from"; readonly detail: string }

export function indexed(values: readonly number[]): string {
  return values.map((value) => String(value)).join(" and ")
}

function paragraphSentence(file: TextValue): string {
  if (file.length === 0) return "The file has no paragraphs."
  return `The file has paragraphs ${indexed(file.map((paragraph) => paragraph.from))}.`
}

function runSentence(paragraphFrom: number, runs: readonly TextRun[]): string {
  const name = `Paragraph ${String(paragraphFrom)} of the file`
  if (runs.length === 0) return `${name} has no runs. Use -1 for a new run.`
  return `${name} has runs ${indexed(runs.map((run) => run.from))}. Use one of them, or -1 for a new run.`
}

export function runProblem(file: TextValue, next: TextValue): TextProblem | undefined {
  for (const paragraph of next) {
    const source = file.find((item) => item.from === paragraph.from)
    if (source === undefined) return { code: "text-from", detail: paragraphSentence(file) }
    for (const run of paragraph.runs) {
      if (run.from === -1) continue
      if (source.runs.some((item) => item.from === run.from)) continue
      return { code: "text-from", detail: runSentence(paragraph.from, source.runs) }
    }
  }
  return undefined
}

export function looksLikeJson(value: string): boolean {
  const first = value.trimStart()[0]
  return first === "[" || first === "{"
}

export const notTextValue =
  "The text looks like JSON and is not a text value, so nothing landed. A text value is [{from, runs:[{from, text}]}]: a paragraph's from is one the layer has, repeated for another paragraph, and a run's from is one it has or -1. Send plain text for plain words."

const newLayer: TextValue = [{ from: 0, runs: [{ from: 0, text: "" }] }]
const emptyCell: TextValue = [{ from: 0, runs: [] }]

function gridProblem(file: TableValue, next: TableValue): TextProblem | undefined {
  const width = file.rows[0]?.cells.length ?? 0
  const row = next.rows.find((each) => each.from >= file.rows.length)
  if (row !== undefined)
    return {
      code: "text-from",
      detail: `The file's table has rows ${indexed(file.rows.map((each) => each.from))}. Use one of them, or -1 for a new row.`,
    }
  if (tableColumns(next).some((from) => from >= width))
    return {
      code: "text-from",
      detail: `The file's table has ${String(width)} columns, numbered from 0. Use one of them in columns, or -1 for a new column.`,
    }
  return undefined
}

export function cellProblem(file: TableValue, next: TableValue): TextProblem | undefined {
  const grid = gridProblem(file, next)
  if (grid !== undefined) return grid
  const columns = tableColumns(next)
  for (const row of next.rows) {
    const source = file.rows.find((each) => each.from === row.from)
    for (const [at, cell] of row.cells.entries()) {
      const column = columns[at] ?? -1
      const problem = runProblem(
        source === undefined || column < 0 ? emptyCell : (source.cells[column] ?? emptyCell),
        cell,
      )
      if (problem !== undefined)
        return { code: problem.code, detail: `Row ${String(row.from)}, cell ${String(at)}: ${problem.detail}` }
    }
  }
  return undefined
}

export function textProblem(
  floors: ReadonlyMap<ElementId, string>,
  changes: readonly WireChange[],
): TextProblem | undefined {
  for (const change of changes) {
    if (change.property === "box" || slideKind(change.node) !== null) continue
    const floor = floors.get(change.node)
    if (floor === undefined) continue
    const table = readTableValue(floor)
    const sent = table === null ? null : readTableValue(change.value)
    if (table !== null && sent !== null) {
      const problem = cellProblem(table, sent)
      if (problem !== undefined) return problem
      continue
    }
    const file = floor === "" ? newLayer : readTextValue(floor)
    if (file === null) continue
    const next = readTextValue(change.value)
    if (next === null && looksLikeJson(change.value)) return { code: "field", detail: notTextValue }
    if (next === null) continue
    const problem = runProblem(file, next)
    if (problem !== undefined) return problem
  }
  return undefined
}

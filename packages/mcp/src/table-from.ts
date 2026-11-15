import type { WireChange } from "@airdesign/catalog"
import { readTableValue, tableColumns, type ElementId, type TableValue } from "@airdesign/document"
import { indexed, runProblem, type TextProblem } from "./text-from.js"

const notTable =
  "Send a JSON table value for this table, as airdesign_read_deck lists it. Each from must be one the file has, and -1 is a new one."

function spanSentence(count: number, name: "row" | "column"): string {
  const all = Array.from({ length: count }, (_, at) => at)
  return `The file's table has ${name}s ${indexed(all)}. Use one of them, or -1 for a new ${name}.`
}

function cellsProblem(file: TableValue, value: string): TextProblem | undefined {
  const next = readTableValue(value)
  if (next === null) return { code: "field", detail: notTable }
  const columns = file.rows[0]?.cells.length ?? 0
  if (next.rows.some((row) => row.from >= file.rows.length))
    return { code: "text-from", detail: spanSentence(file.rows.length, "row") }
  const sources = tableColumns(next)
  if (sources.some((from) => from >= columns)) return { code: "text-from", detail: spanSentence(columns, "column") }
  for (const row of next.rows)
    for (const [at, cell] of row.cells.entries()) {
      const source = file.rows[row.from]?.cells[sources[at] ?? -1]
      const problem = source === undefined ? undefined : runProblem(source, cell)
      if (problem !== undefined) return problem
    }
  return undefined
}

export function tableProblem(
  floors: ReadonlyMap<ElementId, string>,
  changes: readonly WireChange[],
): TextProblem | undefined {
  for (const change of changes) {
    if (change.property === "box") continue
    const floor = floors.get(change.node)
    const file = floor === undefined ? null : readTableValue(floor)
    const problem = file === null ? undefined : cellsProblem(file, change.value)
    if (problem !== undefined) return problem
  }
  return undefined
}

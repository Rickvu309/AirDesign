import { readTableValue, writeTableValue } from "./table-value.js"
import { readTextValue, writeTextValue, type TextParagraph, type TextRun, type TextValue } from "./text-value.js"

const lineBreak = /\r\n|\r|\n/

function keptSoftBreak(run: TextRun): boolean {
  return run.from >= 0 && run.text === "\n"
}

function broken(value: TextValue): boolean {
  return value.some((paragraph) => paragraph.runs.some((run) => !keptSoftBreak(run) && lineBreak.test(run.text)))
}

function paragraphed(value: TextValue): TextValue {
  return value.flatMap((paragraph) => {
    const made: { runs: TextRun[]; paragraph: TextParagraph }[] = [{ runs: [], paragraph }]
    for (const run of paragraph.runs) {
      if (keptSoftBreak(run)) {
        made.at(-1)?.runs.push(run)
        continue
      }
      for (const [at, line] of run.text.split(lineBreak).entries()) {
        if (at > 0) made.push({ runs: [], paragraph })
        if (line !== "") made.at(-1)?.runs.push({ ...run, text: line })
      }
    }
    return made.map(({ runs, paragraph: source }) => ({ ...source, runs }))
  })
}

export function paragraphedText(stored: string): string {
  const read = readTextValue(stored)
  if (read === null)
    return lineBreak.test(stored)
      ? writeTextValue(paragraphed([{ from: 0, runs: [{ from: 0, text: stored }] }]))
      : stored
  return broken(read) ? writeTextValue(paragraphed(read)) : stored
}

export function paragraphedTable(stored: string): string {
  const table = readTableValue(stored)
  if (table === null || !table.rows.some((row) => row.cells.some(broken))) return stored
  return writeTableValue({
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => (broken(cell) ? paragraphed(cell) : cell)),
    })),
  })
}

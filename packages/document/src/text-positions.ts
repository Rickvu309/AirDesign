import { readTextValue, writeTextValue, type TextValue } from "./text-value.js"

const newLayer: TextValue = [{ from: 0, runs: [{ from: 0, text: "" }] }]

export function numberedText(stored: string): string {
  const read = readTextValue(stored)
  if (read === null) return stored
  const numbered = read.map((paragraph, at) => ({
    ...paragraph,
    from: at,
    runs: paragraph.runs.map((run, place) => ({ ...run, from: place })),
  }))
  const shown = writeTextValue(numbered)
  return shown === writeTextValue(read) ? stored : shown
}

export function positionedText(current: string | null, sent: string): string {
  const next = readTextValue(sent)
  if (next === null) return sent
  const read = readTextValue(current ?? "") ?? newLayer
  let before = read[0]
  return writeTextValue(
    next.map((paragraph) => {
      const source = read[paragraph.from] ?? before
      before = source
      return {
        ...paragraph,
        from: source?.from ?? 0,
        runs: paragraph.runs.map((run) => ({ ...run, from: source?.runs[run.from]?.from ?? -1 })),
      }
    }),
  )
}

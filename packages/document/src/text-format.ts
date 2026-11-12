import type { TextFormat, TextParagraph, TextRun, TextValue } from "./text-value.js"
import { formatNames } from "./text-value.js"

export type Caret = { readonly paragraph: number; readonly offset: number }
export type TextRange = { readonly start: Caret; readonly end: Caret }
export type FormatState = "on" | "off" | "mixed"
export type FileFormat = (paragraph: number, run: number, format: TextFormat) => boolean

type Piece = { readonly run: TextRun; readonly covered: boolean }

function setFormat(run: TextRun, paragraph: number, format: TextFormat, on: boolean, file: FileFormat): TextRun {
  const { [format]: _dropped, ...rest } = run
  return on === file(paragraph, run.from, format) ? rest : { ...rest, [format]: on }
}

export function sameFormats(left: TextRun, right: TextRun): boolean {
  return formatNames.every((format) => left[format] === right[format])
}

function merged(runs: readonly TextRun[]): readonly TextRun[] {
  const kept: TextRun[] = []
  for (const run of runs) {
    const last = kept.at(-1)
    if (last !== undefined && last.from === run.from && sameFormats(last, run)) {
      kept[kept.length - 1] = { ...last, text: last.text + run.text }
    } else kept.push(run)
  }
  return kept
}

function bounds(range: TextRange, index: number): readonly [number, number] | null {
  if (index < range.start.paragraph || index > range.end.paragraph) return null
  return [
    index === range.start.paragraph ? range.start.offset : 0,
    index === range.end.paragraph ? range.end.offset : Number.POSITIVE_INFINITY,
  ]
}

function pieces(paragraph: TextParagraph, lo: number, hi: number): readonly Piece[] {
  const cut: Piece[] = []
  let start = 0
  for (const run of paragraph.runs) {
    const end = start + run.text.length
    const from = Math.max(start, lo)
    const to = Math.min(end, hi)
    if (from >= to) cut.push({ run, covered: false })
    else {
      const head = run.text.slice(0, from - start)
      const body = run.text.slice(from - start, to - start)
      const tail = run.text.slice(to - start)
      if (head !== "") cut.push({ run: { ...run, text: head }, covered: false })
      cut.push({ run: { ...run, text: body }, covered: true })
      if (tail !== "") cut.push({ run: { ...run, text: tail }, covered: false })
    }
    start = end
  }
  return cut
}

function covered(value: TextValue, range: TextRange | null): readonly (readonly Piece[])[] {
  return value.map((paragraph, index) => {
    if (range === null) return paragraph.runs.map((run) => ({ run, covered: true }))
    const span = bounds(range, index)
    return span === null ? paragraph.runs.map((run) => ({ run, covered: false })) : pieces(paragraph, ...span)
  })
}

function formatted(
  value: TextValue,
  range: TextRange | null,
  format: TextFormat,
  on: boolean,
  file: FileFormat,
): TextValue {
  const cut = covered(value, range)
  return value.map((paragraph, index) => {
    const parts = cut[index] ?? []
    if (!parts.some((part) => part.covered)) return paragraph
    const runs = parts.map((part) => (part.covered ? setFormat(part.run, paragraph.from, format, on, file) : part.run))
    return { from: paragraph.from, runs: merged(runs) }
  })
}

export function formatRange(
  value: TextValue,
  range: TextRange,
  format: TextFormat,
  on: boolean,
  file: FileFormat,
): TextValue {
  return formatted(value, range, format, on, file)
}

export function formatWhole(value: TextValue, format: TextFormat, on: boolean, file: FileFormat): TextValue {
  return formatted(value, null, format, on, file)
}

export function formatState(
  value: TextValue,
  range: TextRange | null,
  format: TextFormat,
  file: FileFormat,
): FormatState {
  const cut = covered(value, range)
  const shown = value.flatMap((paragraph, index) =>
    (cut[index] ?? [])
      .filter((part) => part.covered)
      .map((part) => ({ text: part.run.text, on: part.run[format] ?? file(paragraph.from, part.run.from, format) })),
  )
  const read = shown.some((part) => part.text !== "") ? shown.filter((part) => part.text !== "") : shown
  const states = new Set(read.map((part) => part.on))
  if (states.size > 1) return "mixed"
  return states.has(true) ? "on" : "off"
}

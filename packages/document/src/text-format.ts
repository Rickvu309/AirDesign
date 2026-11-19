import { sameColor, type Color } from "./color.js"
import type { ElementLink, LinkEdit } from "./link-target.js"
import type { ParagraphAlign, TextList, TextFormat, TextParagraph, TextRun, TextValue } from "./text-value.js"
import { formatNames, sizeCeiling, sizeDefault, sizeFloor } from "./text-value.js"

export type Caret = { readonly paragraph: number; readonly offset: number }
export type TextRange = { readonly start: Caret; readonly end: Caret }
export type FormatState = "on" | "off" | "mixed"
export type FileFormat = (paragraph: number, run: number, format: TextFormat) => boolean
export type FileSize = (paragraph: number, run: number) => number | null
export type FileColor = (paragraph: number, run: number) => Color | null
export type FileAlign = (paragraph: number) => ParagraphAlign | null
export type FileList = (paragraph: number) => TextList

export type SizeStep = 1 | -1

type Piece = { readonly run: TextRun; readonly covered: boolean }

const sizeSteps = [
  800, 900, 1000, 1050, 1100, 1200, 1400, 1600, 1800, 2000, 2400, 2800, 3200, 3600, 4000, 4400, 4800, 5400, 6000, 6600,
  7200, 8000, 8800, 9600,
] as const
const smallStep = 100
const largeStep = 1000
const typedPoints = /^\d+(\.\d+)?$/

function setFormat(run: TextRun, paragraph: number, format: TextFormat, on: boolean, file: FileFormat): TextRun {
  const { [format]: _dropped, ...rest } = run
  return on === file(paragraph, run.from, format) ? rest : { ...rest, [format]: on }
}

export function sameFormats(left: TextRun, right: TextRun): boolean {
  return (
    formatNames.every((format) => left[format] === right[format]) &&
    JSON.stringify(left.link) === JSON.stringify(right.link) &&
    left.size === right.size &&
    left.font === right.font &&
    left.case === right.case &&
    left.letterSpacing === right.letterSpacing &&
    JSON.stringify(left.fill) === JSON.stringify(right.fill) &&
    sameColor(left.color, right.color)
  )
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
    return { ...paragraph, runs: merged(runs) }
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

function applyRuns(
  value: TextValue,
  range: TextRange | null,
  change: (paragraph: TextParagraph, run: TextRun) => TextRun,
): TextValue {
  const cut = covered(value, range)
  return value.map((paragraph, index) => {
    const parts = cut[index] ?? []
    if (!parts.some((part) => part.covered)) return paragraph
    const runs = parts.map((part) => (part.covered ? change(paragraph, part.run) : part.run))
    return { ...paragraph, runs: merged(runs) }
  })
}

function coveredRuns(
  value: TextValue,
  range: TextRange | null,
): readonly { readonly paragraph: TextParagraph; readonly run: TextRun }[] {
  const cut = covered(value, range)
  const shown = value.flatMap((paragraph, index) =>
    (cut[index] ?? []).filter((part) => part.covered).map((part) => ({ paragraph, run: part.run })),
  )
  const filled = shown.filter((part) => part.run.text !== "")
  return filled.length > 0 ? filled : shown
}

function uniform<T>(values: readonly T[], same: (left: T, right: T) => boolean): T | "mixed" | null {
  if (values.length === 0) return null
  const first = values[0] as T
  return values.every((value) => same(value, first)) ? first : "mixed"
}

function setSize(run: TextRun, paragraphFrom: number, size: number, file: FileSize): TextRun {
  const { size: _dropped, ...rest } = run
  return size === file(paragraphFrom, run.from) ? rest : { ...rest, size }
}

function setColor(run: TextRun, paragraphFrom: number, color: Color, file: FileColor): TextRun {
  const { color: _dropped, fill: _fill, ...rest } = run
  return sameColor(color, file(paragraphFrom, run.from)) ? rest : { ...rest, color }
}

export function sizeRange(value: TextValue, range: TextRange | null, size: number, file: FileSize): TextValue {
  return applyRuns(value, range, (paragraph, run) => setSize(run, paragraph.from, size, file))
}

function stepUp(size: number): number {
  const least = sizeSteps[0]
  if (size < least) return Math.min(least, Math.floor(size / smallStep) * smallStep + smallStep)
  return sizeSteps.find((listed) => listed > size) ?? Math.floor(size / largeStep) * largeStep + largeStep
}

function stepDown(size: number): number {
  const most = sizeSteps[sizeSteps.length - 1] ?? sizeFloor
  if (size > most) return Math.max(most, Math.ceil(size / largeStep) * largeStep - largeStep)
  return sizeSteps.findLast((listed) => listed < size) ?? Math.ceil(size / smallStep) * smallStep - smallStep
}

export function steppedSize(size: number, step: SizeStep): number {
  return Math.min(sizeCeiling, Math.max(sizeFloor, step > 0 ? stepUp(size) : stepDown(size)))
}

export function typedSize(text: string): number | null {
  const trimmed = text.trim()
  if (!typedPoints.test(trimmed)) return null
  const size = Math.round(Number(trimmed) * 10) * 10
  return size < sizeFloor || size > sizeCeiling ? null : size
}

export function stepSize(value: TextValue, range: TextRange | null, step: SizeStep, file: FileSize): TextValue {
  return applyRuns(value, range, (paragraph, run) => {
    const current = run.size ?? file(paragraph.from, run.from) ?? sizeDefault
    return setSize(run, paragraph.from, steppedSize(current, step), file)
  })
}

export function sizeState(value: TextValue, range: TextRange | null, file: FileSize): number | "mixed" | null {
  const sizes = coveredRuns(value, range).map(
    (part) => part.run.size ?? file(part.paragraph.from, part.run.from) ?? sizeDefault,
  )
  return uniform(sizes, (left, right) => left === right)
}

export function colorRange(value: TextValue, range: TextRange | null, color: Color, file: FileColor): TextValue {
  return applyRuns(value, range, (paragraph, run) => setColor(run, paragraph.from, color, file))
}

export function colorState(value: TextValue, range: TextRange | null, file: FileColor): Color | "mixed" | null {
  const colors = coveredRuns(value, range).map(
    (part) => part.run.color ?? file(part.paragraph.from, part.run.from) ?? null,
  )
  return uniform(colors, sameColor)
}

function hit(value: TextValue, range: TextRange | null): readonly TextParagraph[] {
  return value.filter((_, index) => range === null || bounds(range, index) !== null)
}

function applyParagraphs(
  value: TextValue,
  range: TextRange | null,
  change: (paragraph: TextParagraph) => TextParagraph,
): TextValue {
  return value.map((paragraph, index) =>
    range === null || bounds(range, index) !== null ? change(paragraph) : paragraph,
  )
}

export function alignRange(
  value: TextValue,
  range: TextRange | null,
  align: ParagraphAlign,
  file: FileAlign,
): TextValue {
  return applyParagraphs(value, range, (paragraph) => {
    const { align: _dropped, ...rest } = paragraph
    return align === file(paragraph.from) ? rest : { ...rest, align }
  })
}

export function alignState(
  value: TextValue,
  range: TextRange | null,
  file: FileAlign,
): ParagraphAlign | "mixed" | null {
  const aligns = hit(value, range).map((paragraph) => paragraph.align ?? file(paragraph.from) ?? null)
  return uniform(aligns, (left, right) => left === right)
}

export function bulletRange(value: TextValue, range: TextRange | null, on: boolean, file: FileList): TextValue {
  return applyParagraphs(value, range, (paragraph) => {
    const { list: _dropped, ...rest } = paragraph
    const list = on ? "bullets" : "none"
    return list === file(paragraph.from) ? rest : { ...rest, list }
  })
}

export function bulletState(value: TextValue, range: TextRange | null, file: FileList): FormatState {
  const flags = hit(value, range).map((paragraph) => (paragraph.list ?? file(paragraph.from)) === "bullets")
  const states = new Set(flags)
  if (states.size > 1) return "mixed"
  return states.has(true) ? "on" : "off"
}

export function linkRange(value: TextValue, range: TextRange | null, link: LinkEdit): TextValue {
  return applyRuns(value, range, (_paragraph, run) => ({
    ...run,
    link,
    ...(link.kind === "none" ? {} : { underline: true }),
  }))
}

export function linkState(value: TextValue, range: TextRange | null): ElementLink | "mixed" | null {
  return uniform(
    coveredRuns(value, range).map(({ run }) => run.link ?? ({ kind: "none" } as const)),
    (a, b) => JSON.stringify(a) === JSON.stringify(b),
  )
}

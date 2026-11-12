import { onlyKeys, record } from "./plain-object.js"

export const formatNames = ["bold", "italic", "underline"] as const

export type TextFormat = (typeof formatNames)[number]

export type RunFormat = { readonly [format in TextFormat]?: boolean }

export type TextRun = { readonly from: number; readonly text: string } & RunFormat
export type TextParagraph = { readonly from: number; readonly runs: readonly TextRun[] }
export type TextValue = readonly TextParagraph[]

const paragraphKeys = ["from", "runs"]
const runKeys = new Set<string>(["from", "text", ...formatNames])

function integerAtLeast(value: unknown, floor: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < floor) {
    return null
  }
  return Object.is(value, -0) ? 0 : value
}

function readRun(value: unknown): TextRun | null {
  const run = record(value)
  if (run === null || !Object.keys(run).every((key) => runKeys.has(key))) {
    return null
  }
  const from = integerAtLeast(run.from, -1)
  if (from === null || typeof run.text !== "string") {
    return null
  }
  let read: TextRun = { from, text: run.text }
  for (const format of formatNames) {
    const set = run[format]
    if (set === undefined) continue
    if (typeof set !== "boolean") return null
    read = { ...read, [format]: set }
  }
  return read
}

function readParagraph(value: unknown): TextParagraph | null {
  const paragraph = record(value)
  if (paragraph === null || !onlyKeys(paragraph, paragraphKeys) || !Array.isArray(paragraph.runs)) {
    return null
  }
  const from = integerAtLeast(paragraph.from, 0)
  if (from === null) {
    return null
  }
  const runs: TextRun[] = []
  for (const item of paragraph.runs) {
    const run = readRun(item)
    if (run === null) {
      return null
    }
    runs.push(run)
  }
  return { from, runs }
}

export function readTextValue(value: string): TextValue | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null
  }
  const paragraphs: TextParagraph[] = []
  for (const item of parsed) {
    const paragraph = readParagraph(item)
    if (paragraph === null) {
      return null
    }
    paragraphs.push(paragraph)
  }
  return paragraphs
}

function writtenRun(run: TextRun): Record<string, unknown> {
  const written: Record<string, unknown> = { from: run.from, text: run.text }
  for (const format of formatNames) if (run[format] !== undefined) written[format] = run[format]
  return written
}

export function writeTextValue(text: TextValue): string {
  return JSON.stringify(
    text.map((paragraph) => ({
      from: paragraph.from,
      runs: paragraph.runs.map(writtenRun),
    })),
  )
}

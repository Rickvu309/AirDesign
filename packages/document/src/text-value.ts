import { onlyKeys, record } from "./plain-object.js"

export type TextRun = { readonly from: number; readonly text: string }
export type TextParagraph = { readonly from: number; readonly runs: readonly TextRun[] }
export type TextValue = readonly TextParagraph[]

const paragraphKeys = ["from", "runs"]
const runKeys = ["from", "text"]

function integerAtLeast(value: unknown, floor: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < floor) {
    return null
  }
  return Object.is(value, -0) ? 0 : value
}

function readRun(value: unknown): TextRun | null {
  const run = record(value)
  if (run === null || !onlyKeys(run, runKeys)) {
    return null
  }
  const from = integerAtLeast(run.from, -1)
  if (from === null || typeof run.text !== "string") {
    return null
  }
  return { from, text: run.text }
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
  return readParagraphs(parsed)
}

export function readParagraphs(parsed: unknown): TextValue | null {
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

export function writeTextValue(text: TextValue): string {
  return JSON.stringify(
    text.map((paragraph) => ({
      from: paragraph.from,
      runs: paragraph.runs.map((run) => ({ from: run.from, text: run.text })),
    })),
  )
}

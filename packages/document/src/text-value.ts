import { readColor, writtenColor, type Color } from "./color.js"
import { record } from "./plain-object.js"

export const formatNames = ["bold", "italic", "underline"] as const
export const schemeNames = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
] as const
export const alignNames = ["left", "center", "right"] as const
export const sizeFloor = 100
export const sizeCeiling = 400_000
export const sizeDefault = 1800

export type TextFormat = (typeof formatNames)[number]
export type SchemeName = (typeof schemeNames)[number]
export type ParagraphAlign = (typeof alignNames)[number]
export type RunFormat = { readonly [format in TextFormat]?: boolean }

export type TextRun = {
  readonly from: number
  readonly text: string
  readonly size?: number
  readonly color?: Color
} & RunFormat
export type TextParagraph = {
  readonly from: number
  readonly align?: ParagraphAlign
  readonly bullet?: boolean
  readonly runs: readonly TextRun[]
}
export type TextValue = readonly TextParagraph[]

const paragraphKeys = new Set<string>(["from", "runs", "align", "bullet"])
const runKeys = new Set<string>(["from", "text", "size", "color", ...formatNames])

function named<T extends string>(names: readonly T[], value: string): T | null {
  for (const name of names) if (name === value) return name
  return null
}

function integerAtLeast(value: unknown, floor: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < floor) {
    return null
  }
  return Object.is(value, -0) ? 0 : value
}

function readSize(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "number" || !Number.isInteger(value) || value < sizeFloor || value > sizeCeiling) return null
  return value
}

function readRun(value: unknown): TextRun | null {
  const run = record(value)
  if (run === null || !Object.keys(run).every((key) => runKeys.has(key))) {
    return null
  }
  const from = integerAtLeast(run.from, -1)
  const size = readSize(run.size)
  const color = readColor(run.color)
  if (from === null || typeof run.text !== "string" || size === null || color === null) {
    return null
  }
  let read: TextRun = { from, text: run.text }
  for (const format of formatNames) {
    const set = run[format]
    if (set === undefined) continue
    if (typeof set !== "boolean") return null
    read = { ...read, [format]: set }
  }
  if (size !== undefined) read = { ...read, size }
  if (color !== undefined) read = { ...read, color }
  return read
}

function readParagraph(value: unknown): TextParagraph | null {
  const paragraph = record(value)
  if (
    paragraph === null ||
    !Object.keys(paragraph).every((key) => paragraphKeys.has(key)) ||
    !Object.hasOwn(paragraph, "from") ||
    !Array.isArray(paragraph.runs)
  ) {
    return null
  }
  const from = integerAtLeast(paragraph.from, 0)
  const align =
    paragraph.align === undefined
      ? undefined
      : named(alignNames, typeof paragraph.align === "string" ? paragraph.align : "")
  if (from === null || (paragraph.align !== undefined && align === null)) return null
  if (paragraph.bullet !== undefined && typeof paragraph.bullet !== "boolean") return null
  const runs: TextRun[] = []
  for (const item of paragraph.runs) {
    const run = readRun(item)
    if (run === null) return null
    runs.push(run)
  }
  let read: TextParagraph = { from, runs }
  if (align !== undefined && align !== null) read = { ...read, align }
  if (typeof paragraph.bullet === "boolean") read = { ...read, bullet: paragraph.bullet }
  return read
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

function writtenRun(run: TextRun): Record<string, unknown> {
  const written: Record<string, unknown> = { from: run.from, text: run.text }
  for (const format of formatNames) if (run[format] !== undefined) written[format] = run[format]
  if (run.size !== undefined) written.size = run.size
  if (run.color !== undefined) written.color = writtenColor(run.color)
  return written
}

function writtenParagraph(paragraph: TextParagraph): Record<string, unknown> {
  const written: Record<string, unknown> = { from: paragraph.from }
  if (paragraph.align !== undefined) written.align = paragraph.align
  if (paragraph.bullet !== undefined) written.bullet = paragraph.bullet
  written.runs = paragraph.runs.map(writtenRun)
  return written
}

export function writeTextValue(text: TextValue): string {
  return JSON.stringify(text.map(writtenParagraph))
}

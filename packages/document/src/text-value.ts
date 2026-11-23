import { readColor, writtenColor, type Color } from "./color.js"
import { readElementLink, type ElementLink } from "./link-target.js"
import { readTextFill, type TextFill } from "./text-fill.js"
import { canonicalKeys } from "./key-alias.js"
import { bytesOf } from "@airdesign/doom"
import { record } from "./plain-object.js"

import { readSlideNumber, type SlideNumber } from "./slide-number.js"

export const formatNames = ["bold", "italic", "underline", "strike"] as const
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
export const alignNames = ["left", "center", "right", "justify"] as const
export const caseNames = ["none", "upper", "lower", "title", "small"] as const
export type TextCase = (typeof caseNames)[number]
import { sizeFloor, sizeCeiling } from "./text-size.js"
export { sizeFloor, sizeCeiling } from "./text-size.js"
export const sizeDefault = 1800
export const typefaceBytes = 64
export const letterSpacingFloor = -400_000
export const letterSpacingCeiling = 400_000
export const listNames = ["none", "bullets", "numbers"] as const
export type TextList = (typeof listNames)[number]
export const lastListLevel = 8
export const lineHeightFloor = 10_000
export const lineHeightCeiling = 1_000_000
export const spaceCeiling = 158_400
export const lineHeightPointsFloor = 100

export type TextFormat = (typeof formatNames)[number]
export type SchemeName = (typeof schemeNames)[number]
export type ParagraphAlign = (typeof alignNames)[number]
export type RunFormat = { readonly [format in TextFormat]?: boolean }

export type TextRun = {
  readonly from: number
  readonly text: string
  readonly slideNumber?: SlideNumber
  readonly size?: number
  readonly fill?: TextFill
  readonly color?: Color
  readonly link?: ElementLink
  readonly font?: string
  readonly letterSpacing?: number
  readonly case?: TextCase
} & RunFormat
export type ParagraphSpacing = {
  readonly lineHeight?: number
  readonly lineHeightPoints?: number
  readonly spaceBefore?: number
  readonly spaceAfter?: number
}
export type TextParagraph = {
  readonly from: number
  readonly align?: ParagraphAlign
  readonly list?: TextList
  readonly level?: number
  readonly runs: readonly TextRun[]
} & ParagraphSpacing
export type TextValue = readonly TextParagraph[]

export const spacingNames = ["lineHeight", "lineHeightPoints", "spaceBefore", "spaceAfter"] as const
const spacingRange: Readonly<Record<(typeof spacingNames)[number], readonly [number, number]>> = {
  lineHeight: [lineHeightFloor, lineHeightCeiling],
  lineHeightPoints: [lineHeightPointsFloor, spaceCeiling],
  spaceBefore: [0, spaceCeiling],
  spaceAfter: [0, spaceCeiling],
}
const paragraphKeys = new Set<string>(["from", "runs", "align", "list", "level", "bullet", ...spacingNames])
const runKeys = new Set<string>([
  "from",
  "text",
  "slideNumber",
  "link",
  "size",
  "fill",
  "color",
  "font",
  "letterSpacing",
  "case",
  ...formatNames,
])

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

export function readTypeface(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== "string" || value.trim() === "" || bytesOf(value) > typefaceBytes) return null
  return value
}

function readSpacing(paragraph: Readonly<Record<string, unknown>>): ParagraphSpacing | null {
  let read: ParagraphSpacing = {}
  for (const name of spacingNames) {
    const value = paragraph[name]
    if (value === undefined) continue
    const [low, high] = spacingRange[name]
    if (typeof value !== "number" || !Number.isInteger(value) || value < low || value > high) return null
    read = { ...read, [name]: value }
  }
  return read.lineHeight !== undefined && read.lineHeightPoints !== undefined ? null : read
}

function readRun(value: unknown): TextRun | null {
  const run = record(value)
  if (run === null || !Object.keys(run).every((key) => runKeys.has(key))) {
    return null
  }
  const from = integerAtLeast(run.from, -1)
  const size = readSize(run.size)
  const fill = run.fill === undefined ? undefined : readTextFill(run.fill)
  if (fill === null || (fill !== undefined && run.color !== undefined)) return null
  const color = readColor(run.color)
  const font = readTypeface(run.font)
  if (from === null || typeof run.text !== "string" || size === null || color === null || font === null) {
    return null
  }
  const slideNumber = readSlideNumber(run.slideNumber)
  if (slideNumber === null && run.slideNumber !== undefined) return null
  let read: TextRun = { from, text: run.text, ...(slideNumber === null ? {} : { slideNumber }) }
  for (const format of formatNames) {
    const set = run[format]
    if (set === undefined) continue
    if (typeof set !== "boolean") return null
    read = { ...read, [format]: set }
  }
  if (run.link !== undefined) {
    const link = readElementLink(run.link)
    if (link === null) return null
    read = { ...read, link }
  }
  if (size !== undefined) read = { ...read, size }
  if (fill !== undefined) read = { ...read, fill }
  if (color !== undefined) read = { ...read, color }
  if (font !== undefined) read = { ...read, font }
  if (run.letterSpacing !== undefined) {
    const letterSpacing = run.letterSpacing
    if (
      typeof letterSpacing !== "number" ||
      !Number.isInteger(letterSpacing) ||
      letterSpacing < letterSpacingFloor ||
      letterSpacing > letterSpacingCeiling
    )
      return null
    read = { ...read, letterSpacing }
  }
  if (run.case !== undefined) {
    const letters = typeof run.case === "string" ? named(caseNames, run.case) : null
    if (letters === null) return null
    read = { ...read, case: letters }
  }
  return read
}

function readParagraph(value: unknown): TextParagraph | null {
  const stored = record(value)
  const paragraph = stored === null ? null : canonicalKeys(stored)
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
  if (paragraph.bullet !== undefined && (typeof paragraph.bullet !== "boolean" || paragraph.list !== undefined))
    return null
  const list = paragraph.bullet === undefined ? paragraph.list : paragraph.bullet ? "bullets" : "none"
  if (list !== undefined && !listNames.some((name) => name === list)) return null
  const spacing = readSpacing(paragraph)
  if (spacing === null) return null
  const level = paragraph.level
  if (
    level !== undefined &&
    (typeof level !== "number" || !Number.isInteger(level) || level < 0 || level > lastListLevel)
  )
    return null
  const runs: TextRun[] = []
  for (const item of paragraph.runs) {
    const run = readRun(item)
    if (run === null) return null
    runs.push(run)
  }
  let read: TextParagraph = { from, runs }
  if (align !== undefined && align !== null) read = { ...read, align }
  if (list === "none" || list === "bullets" || list === "numbers") read = { ...read, list }
  if (typeof level === "number") read = { ...read, level }
  return { ...read, ...spacing }
}

export function noCharacters(value: string): boolean {
  const text = readTextValue(value)
  return text === null ? value === "" : text.every((paragraph) => paragraph.runs.every((run) => run.text === ""))
}

export function plainText(value: TextValue): string {
  return value.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
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
  if (run.slideNumber !== undefined) written.slideNumber = run.slideNumber
  for (const format of formatNames) if (run[format] !== undefined) written[format] = run[format]
  if (run.link !== undefined) written.link = run.link
  if (run.size !== undefined) written.size = run.size
  if (run.fill !== undefined) written.fill = run.fill
  if (run.color !== undefined) written.color = writtenColor(run.color)
  if (run.font !== undefined) written.font = run.font
  if (run.letterSpacing !== undefined) written.letterSpacing = run.letterSpacing
  if (run.case !== undefined) written.case = run.case
  return written
}

function writtenParagraph(paragraph: TextParagraph): Record<string, unknown> {
  const written: Record<string, unknown> = { from: paragraph.from }
  if (paragraph.align !== undefined) written.align = paragraph.align
  if (paragraph.list !== undefined) written.list = paragraph.list
  if (paragraph.level !== undefined) written.level = paragraph.level
  for (const name of spacingNames) if (paragraph[name] !== undefined) written[name] = paragraph[name]
  written.runs = paragraph.runs.map(writtenRun)
  return written
}

export function writeTextValue(text: TextValue): string {
  return JSON.stringify(text.map(writtenParagraph))
}

export function hasSlideNumber(value: string | null): boolean {
  return (
    value !== null &&
    value.includes('"slideNumber"') &&
    readTextValue(value)?.some((paragraph) => paragraph.runs.some((run) => run.slideNumber !== undefined)) === true
  )
}

export function openingSlideNumber(value: string | null): boolean {
  if (!hasSlideNumber(value) || value === null) return false
  const text = readTextValue(value)
  const paragraph = text?.[0]
  return text?.length === 1 && paragraph?.from === 0 && paragraph.runs.length === 1 && paragraph.runs[0]?.from === -1
}

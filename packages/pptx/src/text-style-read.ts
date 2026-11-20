import { alignNames, type TextCase, type TextFill, type ParagraphAlign } from "@airdesign/document"
import { child, inside, whole, type Held } from "./markup-held.js"
import { paintAttribute } from "./paint-color.js"
import { paintReader } from "./paint-reader.js"
import type { PaintParagraph, PaintRunStyle, PaintSpacing } from "./paint-text.js"
import { sheetOf } from "./trait-read.js"

export type ShownTextFill = Exclude<TextFill, { readonly image: string }> | { readonly image: string | null }

export type TextStyleValues = {
  readonly fill: ShownTextFill
  readonly size: number
  readonly font: string
  readonly strike: boolean
  readonly letterSpacing: number
  readonly case: TextCase
  readonly list: "none" | "bullets" | "numbers"
  readonly align: ParagraphAlign
  readonly lineHeight: number | { readonly points: number }
  readonly spaceBefore: number
  readonly spaceAfter: number
}

export type TextStyleField = keyof TextStyleValues

const caseOf = { all: "upper", small: "small", none: "none" } as const

export type ShownTextStyle = {
  readonly [F in TextStyleField]: { readonly value: TextStyleValues[F] | null; readonly own: boolean }
}

export type TextStyleAt = { readonly part: string; readonly shape: string }

function painted(parts: ReadonlyMap<string, Uint8Array>, at: TextStyleAt): PaintParagraph | null {
  const element = paintReader(parts)
    .slide(at.part)
    .elements.find((each) => each.from === "slide" && each.shape === at.shape)
  return element?.text?.paragraphs[0] ?? null
}

function styleOf(paragraph: PaintParagraph): PaintRunStyle {
  return paragraph.runs.find((run) => run.kind === "text" && run.text !== "") ?? paragraph.endStyle
}

function lineHeightOf(spacing: PaintSpacing | null): TextStyleValues["lineHeight"] {
  if (spacing === null) return 100_000
  return "percent" in spacing ? Math.round(spacing.percent * 100_000) : { points: Math.round(spacing.points * 100) }
}

function pointsOf(spacing: PaintSpacing | null): number | null {
  if (spacing === null) return 0
  if ("points" in spacing) return Math.round(spacing.points * 100)
  return spacing.percent === 0 ? 0 : null
}

function alignOf(align: PaintParagraph["align"]): ParagraphAlign | null {
  return alignNames.find((name) => name === align) ?? null
}

function ownHolders(parts: ReadonlyMap<string, Uint8Array>, at: TextStyleAt) {
  const sheet = sheetOf(parts, at.part)
  const item = sheet?.drawn.find((each) => each.shape === at.shape)
  const body =
    sheet === null || item === undefined
      ? undefined
      : child({ element: item.element, children: sheet.children }, "p:txBody")
  const first = body === undefined ? undefined : inside(body).find((each) => each.kind === "a:p")
  if (body === undefined || first === undefined) return { paragraphs: [], runs: [] }
  const paragraph = { ...body, element: first }
  const properties = child(paragraph, "a:pPr")
  const level = properties === undefined ? 0 : (whole(properties.element, "lvl") ?? 0)
  const list = child(body, "a:lstStyle")
  const levels = [child(list, `a:lvl${String(level + 1)}pPr`), child(list, "a:defPPr")]
  const formats = inside(paragraph).flatMap((element) => {
    if (element.kind === "a:endParaRPr") return [{ ...paragraph, element }]
    return element.kind === "a:r" || element.kind === "a:fld" ? [child({ ...paragraph, element }, "a:rPr")] : []
  })
  const paragraphs = present([properties, ...levels])
  return { paragraphs, runs: present([...formats, ...paragraphs.map((held) => child(held, "a:defRPr"))]) }
}

function present(held: readonly (Held | undefined)[]): readonly Held[] {
  return held.filter((each) => each !== undefined)
}

const attribute = (name: string) => (held: Held) => paintAttribute(held.element, name) !== null

const tagged = (kind: string) => (held: Held) => inside(held).some((each) => each.kind === kind)

export function shownTextStyle(parts: ReadonlyMap<string, Uint8Array>, at: TextStyleAt): ShownTextStyle | null {
  const paragraph = painted(parts, at)
  if (paragraph === null) return null
  const style = styleOf(paragraph)
  const { paragraphs, runs } = ownHolders(parts, at)
  return {
    fill: {
      value:
        style.fill ??
        (style.picture === undefined ? null : { image: null }) ??
        (style.color === null ? null : { solid: { rgb: style.color.hex } }),
      own: runs.some((held) =>
        inside(held).some((each) => ["a:solidFill", "a:gradFill", "a:blipFill"].includes(each.kind)),
      ),
    },
    size: { value: Math.round(style.size * 100), own: runs.some(attribute("sz")) },
    font: { value: style.font, own: runs.some(tagged("a:latin")) },
    strike: { value: style.strike, own: runs.some(attribute("strike")) },
    letterSpacing: { value: style.letterSpacing ?? 0, own: runs.some(attribute("spc")) },
    case: { value: caseOf[style.caps ?? "none"], own: runs.some(attribute("cap")) },
    list: {
      value: paragraph.bullet === null ? "none" : "autoNumber" in paragraph.bullet ? "numbers" : "bullets",
      own: paragraphs.some((held) =>
        ["a:buNone", "a:buChar", "a:buAutoNum", "a:buBlip"].some((kind) => tagged(kind)(held)),
      ),
    },
    align: { value: alignOf(paragraph.align), own: paragraphs.some(attribute("algn")) },
    lineHeight: { value: lineHeightOf(paragraph.lineHeight), own: paragraphs.some(tagged("a:lnSpc")) },
    spaceBefore: { value: pointsOf(paragraph.spaceBefore), own: paragraphs.some(tagged("a:spcBef")) },
    spaceAfter: { value: pointsOf(paragraph.spaceAfter), own: paragraphs.some(tagged("a:spcAft")) },
  }
}

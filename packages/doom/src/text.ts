import { limits } from "./limits.js"
import { type Color, type Px, type Sides, readColor, readSides, px, size } from "./paint.js"
import { type Reader, boolean, finite, integer, list, literal, object, reject, words } from "./read-kit.js"
import { readLink } from "./link.js"
import type { NodeId } from "./ids.js"

export const textStyleNames = ["display", "bigNumber", "title", "heading", "body", "body2", "caption", "label"] as const
export type TextStyleName = (typeof textStyleNames)[number]

export const paragraphAligns = ["left", "center", "right", "justify"] as const

export type Span = {
  readonly end: number
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strike?: boolean
  readonly size?: Px
  readonly font?: string
  readonly color?: Color
  readonly tracking?: Px
  readonly case?: "upper" | "lower" | "title"
  readonly figures?: "tabular"
  readonly link?: string | NodeId
}
export type Para = {
  readonly align?: (typeof paragraphAligns)[number]
  readonly list?: "bullet" | "number"
  readonly level?: number
  readonly startAt?: number
  readonly lineHeight?: number
  readonly spaceBefore?: Px
  readonly spaceAfter?: Px
  readonly wrap?: "none"
  readonly maxLines?: number
}
import { readLanguage } from "./language.js"
import { listStart } from "./list-numbers.js"

export type Text = {
  readonly chars: string
  readonly language?: string
  readonly spans: readonly Span[]
  readonly paras: readonly Para[]
  readonly style: TextStyleName
  readonly fontRole?: "heading" | "body"
  readonly resize: "fixed" | "height" | "widthAndHeight" | "truncate"
  readonly alignV: "top" | "center" | "bottom"
  readonly wrap?: "none" | "words"
  readonly padding?: Sides
  readonly overflow?: "ellipsis"
}

export const textLimits = {
  size: { min: 1, max: 2_000 },
  tracking: { min: -100, max: 100 },
  lineHeight: { min: 0.5, max: 5 },
} as const

const readSpan = object(
  { end: integer(1, limits.valueBytes) },
  {
    bold: boolean,
    italic: boolean,
    underline: boolean,
    strike: boolean,
    size: px(textLimits.size.min, textLimits.size.max),
    font: words(100, 1),
    color: readColor,
    tracking: px(textLimits.tracking.min, textLimits.tracking.max),
    case: literal(["upper", "lower", "title"]),
    figures: literal(["tabular"]),
    link: readLink,
  },
)

const readPara = object(
  {},
  {
    align: literal(paragraphAligns),
    list: literal(["bullet", "number"]),
    level: integer(0, 8),
    startAt: integer(listStart.min, listStart.max),
    lineHeight: finite(textLimits.lineHeight.min, textLimits.lineHeight.max),
    spaceBefore: size,
    spaceAfter: size,
    wrap: literal(["none"]),
    maxLines: integer(1, 16),
  },
)

const readFrame = object(
  {
    chars: words(limits.valueBytes),
    spans: list(readSpan, limits.valueBytes),
    paras: list(readPara, limits.valueBytes, 1),
    style: literal(textStyleNames),
    resize: literal(["fixed", "height", "widthAndHeight", "truncate"]),
    alignV: literal(["top", "center", "bottom"]),
  },
  {
    language: readLanguage,
    fontRole: literal(["heading", "body"]),
    padding: readSides,
    wrap: literal(["none", "words"]),
    overflow: literal(["ellipsis"]),
  },
)

export const readText: Reader<Text> = (raw) => {
  const text = readFrame(raw)
  if (text.paras.length !== text.chars.split("\n").length) return reject()
  let at = 0
  for (const span of text.spans) {
    if (span.end <= at || span.end > text.chars.length) return reject()
    at = span.end
  }
  if (text.spans.length > 0 && at !== text.chars.length) return reject()
  return text
}

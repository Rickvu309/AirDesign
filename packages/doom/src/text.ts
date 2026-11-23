import { limits } from "./limits.js"
import { type Color, type Px, type Sides, readColor, readSides, px, size } from "./paint.js"
import { type Reader, boolean, finite, integer, list, literal, object, reject, words } from "./read-kit.js"
import type { NodeId } from "./ids.js"

export const textStyleNames = ["bigNumber", "title", "heading", "body", "body2", "caption", "label"] as const
export type TextStyleName = (typeof textStyleNames)[number]

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
  readonly link?: string | NodeId
}
export type Para = {
  readonly align?: "left" | "center" | "right" | "justify"
  readonly list?: "bullet" | "number"
  readonly level?: number
  readonly lineHeight?: number
  readonly spaceBefore?: Px
  readonly spaceAfter?: Px
}
export type Text = {
  readonly chars: string
  readonly spans: readonly Span[]
  readonly paras: readonly Para[]
  readonly style: TextStyleName
  readonly resize: "fixed" | "height" | "widthAndHeight" | "truncate"
  readonly alignV: "top" | "center" | "bottom"
  readonly padding?: Sides
}

const readSpan = object(
  { end: integer(1, limits.valueBytes) },
  {
    bold: boolean,
    italic: boolean,
    underline: boolean,
    strike: boolean,
    size: px(1, 2_000),
    font: words(100, 1),
    color: readColor,
    tracking: px(-100, 100),
    case: literal(["upper", "lower", "title"]),
    link: words(limits.address, 1),
  },
)

const readPara = object(
  {},
  {
    align: literal(["left", "center", "right", "justify"]),
    list: literal(["bullet", "number"]),
    level: integer(0, 8),
    lineHeight: finite(0.5, 5),
    spaceBefore: size,
    spaceAfter: size,
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
  { padding: readSides },
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

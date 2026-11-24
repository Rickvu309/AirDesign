import { deckOf } from "./deck-of.js"
import type { Doom } from "./doom.js"
import { propOf, slidesOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Measure } from "./measure.js"
import type { Px } from "./paint.js"
import { resolveText } from "./resolve-text.js"
import type { ResolvedLine } from "./resolved.js"
import type { Text } from "./text.js"

type Size = { readonly w: Px; readonly h: Px }
type Band = { readonly x: Px; readonly y: Px; readonly w: Px; readonly h: Px }

const sideShare = 1 / 12
const edgeShare = 1 / 13.5
const gapShare = 0.015
const numberShare = 0.08
const footerHigh = 32
const sourceRows = 2
const ellipsis = "…"
const footerOpacity = 0.6
const footerLead = 1.25

export const footerTop = (height: Px): Px => height - Math.round(height * edgeShare)

export function pageOf(doom: Doom, slide: NodeId): number {
  return slidesOf(doom).findIndex((each) => each.id === slide) + 1
}

function bands(size: Size): { readonly source: Band; readonly number: Band } {
  const x = Math.round(size.w * sideShare)
  const gap = Math.round(size.w * gapShare)
  const numberW = Math.round(size.w * numberShare)
  const numberX = size.w - x - numberW
  const y = footerTop(size.h) + gap
  const top = footerTop(size.h)
  return {
    source: { x, y: top, w: numberX - gap - x, h: y + footerHigh - top },
    number: { x: numberX, y, w: numberW, h: footerHigh },
  }
}

const footerText = (chars: string, align: "left" | "right"): Text => ({
  chars,
  spans: [],
  paras: [{ align, lineHeight: footerLead }],
  style: "caption",
  resize: "fixed",
  alignV: "bottom",
})

export type FooterPart = {
  readonly part: "source" | "number"
  readonly box: Band
  readonly opacity: number
  readonly lines: readonly ResolvedLine[]
}

function partOf(doom: Doom, part: FooterPart["part"], band: Band, text: Text, measure: Measure): FooterPart {
  const { lines } = resolveText(text, deckOf(doom).theme, { x: 0, y: 0, w: band.w, h: band.h }, measure)
  return { part, box: band, opacity: footerOpacity, lines }
}

function sourceText(doom: Doom, words: string, band: Band, measure: Measure): Text {
  const theme = deckOf(doom).theme
  const fits = (text: Text) => {
    const measured = measure(text, theme, band.w)
    return measured.lines.length <= sourceRows && measured.h <= band.h
  }
  const whole = footerText(words, "left")
  if (fits(whole)) return whole
  const chars = [...words]
  const cut = (kept: number) => footerText(`${chars.slice(0, kept).join("").trimEnd()}${ellipsis}`, "left")
  let low = 0
  let high = chars.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (fits(cut(middle))) low = middle
    else high = middle - 1
  }
  return cut(low)
}

export function inkOf(part: FooterPart): Band | null {
  if (part.lines.length === 0) return null
  const lefts = part.lines.map((line) => (line.align === "right" ? line.x + line.w - line.ink : line.x))
  const rights = part.lines.map((line, at) => lefts[at]! + line.ink)
  const left = Math.min(...lefts)
  const top = Math.min(...part.lines.map((line) => line.y))
  const bottom = Math.max(...part.lines.map((line) => line.y + line.h))
  return { x: part.box.x + left, y: part.box.y + top, w: Math.max(...rights) - left, h: bottom - top }
}

export function resolveFooter(doom: Doom, slide: NodeId, measure: Measure): readonly FooterPart[] {
  const page = pageOf(doom, slide)
  if (page === 0) return []
  const { size } = deckOf(doom)
  const { source, number } = bands(size)
  const words = propOf(doom.nodes.get(slide), "source") ?? ""
  return [
    ...(words === "" ? [] : [partOf(doom, "source", source, sourceText(doom, words, source, measure), measure)]),
    partOf(doom, "number", number, footerText(String(page), "right"), measure),
  ]
}

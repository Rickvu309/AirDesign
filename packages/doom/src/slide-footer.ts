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
const footerOpacity = 0.6

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
  return {
    source: { x, y, w: numberX - gap - x, h: footerHigh },
    number: { x: numberX, y, w: numberW, h: footerHigh },
  }
}

const footerText = (chars: string, align: "left" | "right"): Text => ({
  chars,
  spans: [],
  paras: [{ align }],
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

export function resolveFooter(doom: Doom, slide: NodeId, measure: Measure): readonly FooterPart[] {
  const page = pageOf(doom, slide)
  if (page === 0) return []
  const { size } = deckOf(doom)
  const { source, number } = bands(size)
  const words = propOf(doom.nodes.get(slide), "source") ?? ""
  return [
    ...(words === "" ? [] : [partOf(doom, "source", source, footerText(words, "left"), measure)]),
    partOf(doom, "number", number, footerText(String(page), "right"), measure),
  ]
}

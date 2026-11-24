import { deckOf } from "./deck-of.js"
import type { Doom } from "./doom.js"
import { familyOf } from "./painted-face.js"

export type Face = { readonly font: string; readonly bold: boolean; readonly italic: boolean }
export type FaceNeeds = { readonly faces: readonly Face[]; readonly texts: readonly string[] }

const alphabet = Array.from({ length: 95 }, (_, at) => String.fromCharCode(32 + at)).join("") + "•–—…’‘“”°%€£¥×÷·"

export function doomFaces(doom: Doom): FaceNeeds {
  const { theme } = deckOf(doom)
  const fonts = new Set([theme.fonts.heading, theme.fonts.body])
  const texts = new Set([alphabet])
  let italic = false
  for (const node of doom.nodes.values()) {
    const text = node.type === "shape" ? node.text : undefined
    if (text !== undefined) {
      texts.add(text.chars)
      for (const span of text.spans) {
        if (span.font !== undefined) fonts.add(span.font)
        if (span.italic === true) italic = true
      }
    }
    const chart = node.type === "frame" ? node.chart : undefined
    if (chart !== undefined)
      for (const name of [...chart.categories, ...chart.series.map((series) => series.name)]) texts.add(name)
  }
  for (const font of fonts) {
    const family = familyOf(font)
    if (family !== font) fonts.add(family)
  }
  const faces = [...fonts].flatMap((font) => [
    { font, bold: false, italic: false },
    { font, bold: true, italic: false },
    ...(italic
      ? [
          { font, bold: false, italic: true },
          { font, bold: true, italic: true },
        ]
      : []),
  ])
  return { faces, texts: [...texts] }
}

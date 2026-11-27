import { deckOf, propOf } from "./doom-walk.js"
import type { Doom, Write } from "./doom.js"
import type { NodeId } from "./ids.js"
import { type Color, type ColorVar, type Hex, type Paint, colorVars, paletteColorVars } from "./paint.js"
import { type Text, type TextStyleName, textStyleNames } from "./text.js"
import { familyOf } from "./painted-face.js"
import type { Theme } from "./theme.js"

export type ThemeProblem = { readonly node: NodeId } & (
  | { readonly code: "off-scale"; readonly size: number; readonly style: TextStyleName; readonly to: number }
  | { readonly code: "off-palette"; readonly color: Hex; readonly to: ColorVar }
  | { readonly code: "off-font"; readonly font: string; readonly to: readonly string[] }
)

const channels = (hex: Hex) =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number]

function nearestColor(theme: Theme, hex: Hex): ColorVar {
  const [r, g, b] = channels(hex)
  let best: ColorVar = "text"
  let distance = Number.POSITIVE_INFINITY
  for (const name of paletteColorVars) {
    const [tr, tg, tb] = channels(theme.colors[name])
    const mean = (r + tr) / 2
    const near = (2 + mean / 256) * (r - tr) ** 2 + 4 * (g - tg) ** 2 + (2 + (255 - mean) / 256) * (b - tb) ** 2
    if (near < distance) {
      distance = near
      best = name
    }
  }
  return best
}

function nearestStyle(theme: Theme, size: number): TextStyleName {
  let best: TextStyleName = "body"
  for (const name of textStyleNames)
    if (Math.abs(theme.textStyles[name].size - size) < Math.abs(theme.textStyles[best].size - size)) best = name
  return best
}

const paintColors = (paints: readonly Paint[]): readonly Color[] =>
  paints.flatMap((paint) =>
    paint.kind === "solid" ? [paint.color] : paint.kind === "gradient" ? paint.stops.map((stop) => stop.color) : [],
  )

function colorsOf(write: Write): readonly Color[] {
  if (write.value === null) return []
  if (write.prop === "fills" || write.prop === "strokes") return paintColors(write.value as readonly Paint[])
  if (write.prop === "text") return (write.value as Text).spans.flatMap((span) => span.color ?? [])
  return []
}

export function themeProblems(after: Doom, writes: readonly Write[]): readonly ThemeProblem[] {
  const deck = deckOf(after)
  const theme = deck === undefined ? undefined : propOf(deck, "theme")
  if (theme === undefined) return []
  const scale = new Set(textStyleNames.map((name) => theme.textStyles[name].size))
  const palette = new Set(colorVars.map((name) => theme.colors[name].toLowerCase()))
  const families = new Set([theme.fonts.heading, theme.fonts.body])
  const ownFamilies = new Set([...families].map(familyOf))
  const found = new Map<string, ThemeProblem>()
  const keep = (key: string, problem: ThemeProblem) => {
    if (after.nodes.has(problem.node) && !found.has(key)) found.set(key, problem)
  }
  const checkSize = (node: NodeId, size: number) => {
    if (scale.has(size)) return
    const style = nearestStyle(theme, size)
    const to = theme.textStyles[style].size
    keep(`${node}|size|${String(size)}`, { code: "off-scale", node, size, style, to })
  }
  for (const write of writes) {
    const { node, prop, value } = write
    for (const color of colorsOf(write))
      if (typeof color === "string" && !palette.has(color.toLowerCase())) {
        keep(`${node}|${color}`, { code: "off-palette", node, color, to: nearestColor(theme, color) })
      }
    if (prop !== "text" || value === null) continue
    for (const span of (value as Text).spans) {
      if (span.size !== undefined) checkSize(node, span.size)
      if (span.font !== undefined && !ownFamilies.has(familyOf(span.font)))
        keep(`${node}|font|${span.font}`, { code: "off-font", node, font: span.font, to: [...families] })
    }
  }
  return [...found.values()]
}

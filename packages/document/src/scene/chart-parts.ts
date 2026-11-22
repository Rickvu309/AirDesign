import { boxBetween } from "./line-ends.js"
import type { Measure } from "./measure.js"
import type { Hex } from "./paint.js"
import { resolveText } from "./resolve-text.js"
import type { Box, Point, Resolved, ResolvedGeometry, ResolvedPaint } from "./resolved.js"
import type { Text, TextStyleName } from "./text.js"
import type { Theme } from "./theme.js"

export type Words = {
  readonly style: TextStyleName
  readonly color: Hex
  readonly align: "left" | "center" | "right"
  readonly bold?: boolean
}
export type Kit = { readonly theme: Theme; readonly measure: Measure }

export const spot = (x: number, y: number, w: number, h: number): Box => ({
  x,
  y,
  w,
  h,
  rotation: 0,
  flipH: false,
  flipV: false,
})

export const solid = (color: Hex, opacity = 1): ResolvedPaint => ({ kind: "solid", color, opacity })

const part = (id: string, box: Box, geometry: ResolvedGeometry): Resolved => ({
  id,
  type: "shape",
  box,
  opacity: 1,
  fills: [],
  strokes: [],
  stroke: null,
  radius: [0, 0, 0, 0],
  effects: [],
  geometry,
  text: null,
  clip: false,
  children: [],
  derived: true,
})

export const block = (id: string, box: Box, color: Hex, radius = 0): Resolved => ({
  ...part(id, box, { kind: "rect" }),
  fills: [solid(color)],
  radius: [radius, radius, radius, radius],
})

export const disc = (id: string, box: Box, color: Hex, ring: Hex | null): Resolved => ({
  ...part(id, box, { kind: "ellipse" }),
  fills: [solid(color)],
  ...(ring === null ? {} : { strokes: [solid(ring)], stroke: { weight: 3, align: "center", dash: "solid" } as const }),
})

export const rule = (id: string, from: Point, to: Point, color: Hex, weight: number, opacity: number): Resolved => {
  const box = boxBetween(from, to)
  return {
    ...part(id, box, {
      kind: "line",
      from: { x: from.x - box.x, y: from.y - box.y },
      to: { x: to.x - box.x, y: to.y - box.y },
      route: "straight",
      leaves: "across",
      arrives: "across",
      arrows: ["none", "none"],
    }),
    strokes: [solid(color, opacity)],
    stroke: { weight, align: "center", dash: "solid" },
  }
}

export const stroked = (id: string, box: Box, d: string, color: Hex, weight: number): Resolved => ({
  ...part(id, box, { kind: "path", d }),
  strokes: [solid(color)],
  stroke: { weight, align: "center", dash: "solid" },
})

export const slice = (id: string, box: Box, d: string, color: Hex, edge: Hex): Resolved => ({
  ...part(id, box, { kind: "path", d }),
  fills: [solid(color)],
  strokes: [solid(edge)],
  stroke: { weight: 3, align: "center", dash: "solid" },
})

export const whole = (id: string, box: Box, color: Hex): Resolved => ({
  ...part(id, box, { kind: "ellipse" }),
  fills: [solid(color)],
})

const textOf = (chars: string, look: Words): Text => ({
  chars,
  spans: [{ end: chars.length, color: look.color, ...(look.bold === true ? { bold: true } : {}) }],
  paras: chars.split("\n").map(() => ({ align: look.align })),
  style: look.style,
  resize: "fixed",
  alignV: "center",
})

export const wordsWidth = (kit: Kit, chars: string, look: Omit<Words, "align">): number =>
  kit.measure(textOf(chars, { ...look, align: "left" }), kit.theme, null).w

export const wordsHeight = (kit: Kit, look: Omit<Words, "align">): number =>
  kit.measure(textOf("0", { ...look, align: "left" }), kit.theme, null).h

export function words(id: string, kit: Kit, chars: string, box: Box, look: Words): Resolved {
  return { ...part(id, box, { kind: "rect" }), text: resolveText(textOf(chars, look), kit.theme, box, kit.measure) }
}

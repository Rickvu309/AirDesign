import { paintFill } from "./paint-fill.js"
import type { PaintImage } from "./paint-image.js"
import type { PaintColor } from "./paint-color.js"
import type { PaintTextHolder, PaintTextScope } from "./paint-text.js"
import { readTextFill, type TextFill } from "@airdesign/document"
import { fillKinds, fillIn } from "./color-read.js"
import { fillValueOf } from "./fill-read.js"
import type { Held } from "./markup-held.js"

export function runFill(layers: readonly Held[]): TextFill | undefined {
  for (const layer of layers) {
    const held = fillIn(layer)
    if (held !== undefined) return readTextFill(fillValueOf(held, null)) ?? undefined
  }
  return undefined
}

export function runPicture(layers: readonly Held[], scope: PaintTextScope): PaintImage | undefined {
  for (const layer of layers) {
    const held = fillIn(layer)
    if (held === undefined) continue
    const fill = paintFill(layer.element, layer.children, scope.palette, scope.picture ?? (() => null))
    return fill?.type === "picture" ? fill : undefined
  }
  return undefined
}

export const runColor = (layer: PaintTextHolder, scope: PaintTextScope): PaintColor | null | undefined => {
  if (!(layer.children[layer.element.index] ?? []).some((element) => fillKinds.has(element.kind))) return undefined
  const fill = paintFill(layer.element, layer.children, scope.palette, () => null)
  if (fill === null) return null
  if (fill.type === "solid") return fill.color
  if (fill.type === "gradient") return fill.stops[0]?.color ?? null
  return fill.type === "pattern" ? fill.foreground : null
}

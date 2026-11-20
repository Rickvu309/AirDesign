import type { Spot } from "@airdesign/document"
import { snapConnectorEnd } from "./connector-snap.js"
import type { Guide, SnapTargets } from "./snapping.js"
import { snappedTextDraw } from "./text-draw-snap.js"

export type ShapeKind = "box" | "line"

export type DrawKeys = { readonly shift: boolean; readonly alt: boolean; readonly free: boolean }

export type DrawnBox = {
  readonly x: number
  readonly y: number
  readonly cx: number
  readonly cy: number
  readonly flipH: boolean
  readonly flipV: boolean
}

export type DrawnShape = { readonly box: DrawnBox; readonly guides: readonly Guide[] }

function squared(from: Spot, to: Spot): Spot {
  const side = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  return { x: from.x + Math.sign(to.x - from.x || 1) * side, y: from.y + Math.sign(to.y - from.y || 1) * side }
}

function mirrored(centre: Spot, to: Spot): Spot {
  return { x: 2 * centre.x - to.x, y: 2 * centre.y - to.y }
}

function spanOf(start: Spot, end: Spot, flips: boolean): DrawnBox {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    cx: Math.abs(end.x - start.x),
    cy: Math.abs(end.y - start.y),
    flipH: flips && end.x < start.x,
    flipV: flips && end.y < start.y,
  }
}

export function drawnShape(
  kind: ShapeKind,
  from: Spot,
  to: Spot,
  keys: DrawKeys,
  targets: SnapTargets,
  reach: number,
): DrawnShape {
  if (kind === "line") {
    const snapped = snapConnectorEnd(from, to, targets, reach, { shiftKey: keys.shift, ctrlKey: keys.free })
    const start = keys.alt ? mirrored(from, snapped.at) : from
    return { box: spanOf(start, snapped.at, true), guides: snapped.guides }
  }
  const snapped = snappedTextDraw(from, to, targets, reach, keys.free)
  const end = keys.shift ? squared(snapped.from, snapped.to) : snapped.to
  const start = keys.alt ? mirrored(snapped.from, end) : snapped.from
  return { box: spanOf(start, end, false), guides: snapped.guides }
}

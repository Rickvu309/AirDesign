import type { Spot } from "@airdesign/document"
import { guidesAt, nearestLine, type Bounds, type Guide, type SnapTargets, type Watched } from "./snapping.js"

export type EndModifiers = {
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
}

export type SnappedEnd = {
  readonly at: Spot
  readonly guides: readonly Guide[]
}

const octants: readonly Spot[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
]

const bothWatched: Watched = { x: ["start"], y: ["start"], spacing: false }
const acrossWatched: Watched = { x: ["start"], y: [], spacing: false }
const downWatched: Watched = { x: [], y: ["start"], spacing: false }

function clean(value: number): number {
  return value === 0 ? 0 : value
}

function pointBounds(spot: Spot): Bounds {
  return { left: spot.x, top: spot.y, right: spot.x, bottom: spot.y }
}

function rayOf(from: Spot, at: Spot): { readonly way: Spot; readonly length: number } {
  const dx = at.x - from.x
  const dy = at.y - from.y
  if (dx === 0 && dy === 0) return { way: { x: 0, y: 0 }, length: 0 }
  const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  const way = octants[((step % 8) + 8) % 8] ?? { x: 1, y: 0 }
  const denom = way.x * way.x + way.y * way.y
  return { way, length: Math.round((dx * way.x + dy * way.y) / denom) }
}

export function constrainLineEnd(from: Spot, at: Spot): Spot {
  const { way, length } = rayOf(from, at)
  return { x: clean(from.x + way.x * length), y: clean(from.y + way.y * length) }
}

export function snapConnectorEnd(
  from: Spot,
  at: Spot,
  targets: SnapTargets,
  reach: number,
  modifiers: EndModifiers,
): SnappedEnd {
  const raw: Spot = { x: clean(Math.round(at.x)), y: clean(Math.round(at.y)) }
  if (modifiers.ctrlKey) {
    return { at: modifiers.shiftKey ? constrainLineEnd(from, raw) : raw, guides: [] }
  }
  if (!modifiers.shiftKey) {
    const withAnchor: SnapTargets = { ...targets, layers: [...targets.layers, pointBounds(from)] }
    const box = pointBounds(raw)
    const snapX = nearestLine(box, withAnchor, "x", bothWatched.x, reach)
    const snapY = nearestLine(box, withAnchor, "y", bothWatched.y, reach)
    const placed: Spot = {
      x: clean(raw.x + (snapX?.offset ?? 0)),
      y: clean(raw.y + (snapY?.offset ?? 0)),
    }
    return { at: placed, guides: guidesAt(pointBounds(placed), withAnchor, bothWatched) }
  }
  const { way, length } = rayOf(from, raw)
  if (way.x === 0 && way.y === 0) return { at: { x: clean(from.x), y: clean(from.y) }, guides: [] }
  const projected: Spot = { x: clean(from.x + way.x * length), y: clean(from.y + way.y * length) }
  if (way.y === 0) {
    const snapX = nearestLine(pointBounds(projected), targets, "x", acrossWatched.x, reach)
    const placed: Spot = { x: clean(projected.x + (snapX?.offset ?? 0)), y: clean(from.y) }
    return { at: placed, guides: guidesAt(pointBounds(placed), targets, acrossWatched) }
  }
  if (way.x === 0) {
    const snapY = nearestLine(pointBounds(projected), targets, "y", downWatched.y, reach)
    const placed: Spot = { x: clean(from.x), y: clean(projected.y + (snapY?.offset ?? 0)) }
    return { at: placed, guides: guidesAt(pointBounds(placed), targets, downWatched) }
  }
  const box = pointBounds(projected)
  const snapX = nearestLine(box, targets, "x", bothWatched.x, reach)
  const snapY = nearestLine(box, targets, "y", bothWatched.y, reach)
  const deltas = [snapX === null ? null : way.x * snapX.offset, snapY === null ? null : way.y * snapY.offset].filter(
    (delta): delta is number => delta !== null && length + delta >= 0,
  )
  const delta = deltas.sort((left, right) => Math.abs(left) - Math.abs(right))[0] ?? 0
  const nextLength = length + delta
  const placed: Spot = { x: clean(from.x + way.x * nextLength), y: clean(from.y + way.y * nextLength) }
  return { at: placed, guides: guidesAt(pointBounds(placed), targets, bothWatched) }
}

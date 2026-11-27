import type { Rect } from "./layout-problems.js"
import { distanceToSegment } from "./preset-geometry.js"
import type { Point } from "./resolved.js"

type Segment = {
  readonly from: Point
  readonly to: Point
  readonly length: number
  readonly offset: number
}

export type StrokeRoute = {
  readonly points: readonly Point[]
  readonly radius: number
  readonly dash: readonly number[]
  readonly segments: readonly Segment[]
  readonly box: Rect
}

export function strokeRoute(points: readonly Point[], radius: number, dash: readonly number[]): StrokeRoute {
  const segments: Segment[] = []
  let offset = 0
  for (const [index, from] of points.slice(0, -1).entries()) {
    const to = points[index + 1]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length === 0) continue
    segments.push({ from, to, length, offset })
    offset += length
  }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs) - radius
  const y = Math.min(...ys) - radius
  return {
    points,
    radius,
    dash,
    segments,
    box: { x, y, w: Math.max(...xs) + radius - x, h: Math.max(...ys) + radius - y },
  }
}

function windowOn(from: Point, to: Point, box: Rect, extra = 0): readonly [number, number] | null {
  let enter = 0
  let leave = 1
  for (const [start, end, low, high] of [
    [from.x, to.x, box.x - extra, box.x + box.w + extra],
    [from.y, to.y, box.y - extra, box.y + box.h + extra],
  ] as const) {
    const span = end - start
    if (span === 0) {
      if (start < low || start > high) return null
      continue
    }
    const a = (low - start) / span
    const b = (high - start) / span
    enter = Math.max(enter, Math.min(a, b))
    leave = Math.min(leave, Math.max(a, b))
    if (enter > leave) return null
  }
  return [enter, leave]
}

function touchesInk(from: Point, to: Point, ink: Rect, radius: number): boolean {
  if (windowOn(from, to, ink) !== null) return true
  const x = ink.x + ink.w
  const y = ink.y + ink.h
  for (const point of [from, to]) {
    if (Math.hypot(Math.max(ink.x - point.x, point.x - x, 0), Math.max(ink.y - point.y, point.y - y, 0)) < radius)
      return true
  }
  return [ink.x, x].some((cx) => [ink.y, y].some((cy) => distanceToSegment({ x: cx, y: cy }, from, to) < radius))
}

function crossesInk(segment: Segment, ink: Rect, radius: number, dash: readonly number[]): boolean {
  const { from, to, length, offset } = segment
  const range = windowOn(from, to, ink, radius)
  if (range === null) return false
  const [mark, gap] = dash
  if (mark === undefined || gap === undefined || gap < 1) return touchesInk(from, to, ink, radius)
  const period = mark + gap
  const first = range[0] * length
  const last = range[1] * length
  const at = (distance: number) => ({
    x: from.x + ((to.x - from.x) * distance) / length,
    y: from.y + ((to.y - from.y) * distance) / length,
  })
  for (let start = Math.floor((first + offset) / period) * period - offset; start <= last; start += period) {
    const low = Math.max(0, start)
    const high = Math.min(length, start + mark)
    if (low < high && touchesInk(at(low), at(high), ink, radius)) return true
  }
  return false
}

function endsIn(ink: Rect, point: Point | undefined): boolean {
  return (
    point !== undefined && point.x >= ink.x && point.x <= ink.x + ink.w && point.y >= ink.y && point.y <= ink.y + ink.h
  )
}

export function strokeCrosses(stroke: StrokeRoute, ink: Rect, inset: number): boolean {
  const core = { x: ink.x + inset, y: ink.y + inset, w: ink.w - inset * 2, h: ink.h - inset * 2 }
  if (core.w <= 0 || core.h <= 0) return false
  const { box, points, radius, dash, segments } = stroke
  if (core.x >= box.x + box.w || core.x + core.w <= box.x || core.y >= box.y + box.h || core.y + core.h <= box.y)
    return false
  if (endsIn(ink, points[0]) !== endsIn(ink, points.at(-1))) return false
  return segments.some((segment) => crossesInk(segment, core, radius, dash))
}

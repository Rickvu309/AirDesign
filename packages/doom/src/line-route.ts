import type { Point } from "./resolved.js"

export type Side = "t" | "r" | "b" | "l"
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type RouteEnd = { readonly at: Point; readonly side: Side | null; readonly around: Rect | null }

export const stub = 24

const outward: Readonly<Record<Side, Point>> = {
  t: { x: 0, y: -1 },
  r: { x: 1, y: 0 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
}

const swapped: Readonly<Record<Side, Side>> = { t: "l", l: "t", r: "b", b: "r" }

const swap = (point: Point): Point => ({ x: point.y, y: point.x })
const swapEnd = (end: RouteEnd): RouteEnd => ({
  at: swap(end.at),
  side: end.side === null ? null : swapped[end.side],
  around: end.around === null ? null : { x: end.around.y, y: end.around.x, w: end.around.h, h: end.around.w },
})

const plus = (point: Point, toward: Point, by: number): Point => ({
  x: point.x + toward.x * by,
  y: point.y + toward.y * by,
})

function towardOther(from: Point, to: Point): Side {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "r" : "l") : dy >= 0 ? "b" : "t"
}

function tidy(points: readonly Point[]): readonly Point[] {
  const distinct = points.filter(
    (point, at) => at === 0 || point.x !== points[at - 1]!.x || point.y !== points[at - 1]!.y,
  )
  return distinct.filter((point, at) => {
    const before = distinct[at - 1]
    const after = distinct[at + 1]
    if (before === undefined || after === undefined) return true
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y))
  })
}

function aroundY(start: RouteEnd, end: RouteEnd): number {
  const tops = [start.at.y, end.at.y, ...[start.around, end.around].flatMap((rect) => (rect === null ? [] : [rect.y]))]
  const bottoms = [
    start.at.y,
    end.at.y,
    ...[start.around, end.around].flatMap((rect) => (rect === null ? [] : [rect.y + rect.h])),
  ]
  const above = Math.min(...tops) - stub
  const below = Math.max(...bottoms) + stub
  const cost = (y: number) => Math.abs(y - start.at.y) + Math.abs(y - end.at.y)
  return cost(above) <= cost(below) ? above : below
}

function across(start: RouteEnd & { readonly side: "l" | "r" }, end: RouteEnd): readonly Point[] {
  const from = start.at
  const to = end.at
  const leave = outward[start.side]
  const out = plus(from, leave, stub)
  if (end.side === null) {
    return (to.x - from.x) * leave.x > 0 ? [from, { x: to.x, y: from.y }, to] : [from, out, { x: out.x, y: to.y }, to]
  }
  const enter = outward[end.side]
  const into = plus(to, enter, stub)
  if (enter.x === 0) {
    const corner = { x: to.x, y: from.y }
    const clear = (corner.x - from.x) * leave.x >= stub && (corner.y - to.y) * enter.y >= stub
    return clear ? [from, corner, to] : [from, out, { x: out.x, y: into.y }, into, to]
  }
  if (enter.x === leave.x) {
    const x = leave.x > 0 ? Math.max(out.x, into.x) : Math.min(out.x, into.x)
    return [from, { x, y: from.y }, { x, y: to.y }, to]
  }
  if ((into.x - out.x) * leave.x >= 0) {
    const middle = (from.x + to.x) / 2
    return [from, { x: middle, y: from.y }, { x: middle, y: to.y }, to]
  }
  const y = aroundY(start, end)
  return [from, out, { x: out.x, y }, { x: into.x, y }, into, to]
}

function attached(start: RouteEnd & { readonly side: Side }, end: RouteEnd): readonly Point[] {
  if (start.side === "l" || start.side === "r") return across({ ...start, side: start.side }, end)
  const turned = swapEnd(start)
  return across({ ...turned, side: turned.side as "l" | "r" }, swapEnd(end)).map(swap)
}

export function elbowPoints(start: RouteEnd, end: RouteEnd): readonly Point[] {
  if (start.side !== null) return tidy(attached({ ...start, side: start.side }, end))
  if (end.side !== null) return tidy([...attached({ ...end, side: end.side }, start)].reverse())
  const side = towardOther(start.at, end.at)
  const from = start.at
  const to = end.at
  if (side === "l" || side === "r") {
    const middle = (from.x + to.x) / 2
    return tidy([from, { x: middle, y: from.y }, { x: middle, y: to.y }, to])
  }
  const middle = (from.y + to.y) / 2
  return tidy([from, { x: from.x, y: middle }, { x: to.x, y: middle }, to])
}

export function curvePoints(start: RouteEnd, end: RouteEnd): readonly [Point, Point, Point, Point] {
  const from = start.at
  const to = end.at
  const pull = (at: Point, other: Point, side: Side | null) => {
    const toward = outward[side ?? towardOther(at, other)]
    const along = Math.abs((other.x - at.x) * toward.x + (other.y - at.y) * toward.y) / 2
    return plus(at, toward, side === null ? along : Math.max(stub, along))
  }
  return [from, pull(from, to, start.side), pull(to, from, end.side), to]
}

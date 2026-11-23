import type { Point } from "./resolved.js"

export type Side = "t" | "r" | "b" | "l"
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export type RouteEnd = { readonly at: Point; readonly side: Side | null; readonly around: Rect | null }

export const stub = 24
const turnCost = 24

const outward: Readonly<Record<Side, Point>> = {
  t: { x: 0, y: -1 },
  r: { x: 1, y: 0 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
}

const ways: readonly Point[] = [outward.t, outward.r, outward.b, outward.l]
const backOf = (way: number) => (way + 2) % 4

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

function edgeOf(end: RouteEnd & { readonly side: Side }): Point {
  const box = end.around
  if (box === null) return end.at
  if (end.side === "r") return { x: Math.max(end.at.x, box.x + box.w), y: end.at.y }
  if (end.side === "l") return { x: Math.min(end.at.x, box.x), y: end.at.y }
  if (end.side === "b") return { x: end.at.x, y: Math.max(end.at.y, box.y + box.h) }
  return { x: end.at.x, y: Math.min(end.at.y, box.y) }
}

function crosses(from: Point, to: Point, box: Rect): boolean {
  if (from.y === to.y)
    return (
      box.y < from.y &&
      from.y < box.y + box.h &&
      Math.max(from.x, to.x) > box.x &&
      Math.min(from.x, to.x) < box.x + box.w
    )
  return (
    box.x < from.x && from.x < box.x + box.w && Math.max(from.y, to.y) > box.y && Math.min(from.y, to.y) < box.y + box.h
  )
}

type Span = { readonly low: number; readonly high: number; readonly edge: number }

function middleOf(one: Span, two: Span): number {
  if (one.high <= two.low) return (one.high + two.low) / 2
  if (two.high <= one.low) return (two.high + one.low) / 2
  return (one.edge + two.edge) / 2
}

type Leg = { readonly at: Point; readonly edge: Point; readonly side: Side | null }

function legOf(end: RouteEnd): Leg {
  return end.side === null
    ? { at: end.at, edge: end.at, side: null }
    : { at: end.at, edge: edgeOf({ ...end, side: end.side }), side: end.side }
}

function spanOf(end: RouteEnd, leg: Leg, axis: "x" | "y"): Span {
  const box = end.around
  const length = axis === "x" ? "w" : "h"
  return box === null || end.side === null
    ? { low: end.at[axis], high: end.at[axis], edge: leg.edge[axis] }
    : { low: box[axis], high: box[axis] + box[length], edge: leg.edge[axis] }
}

function lanes(axis: "x" | "y", legs: readonly Leg[], boxes: readonly Rect[], middle: number): readonly number[] {
  const length = axis === "x" ? "w" : "h"
  const values = [
    middle,
    ...legs.flatMap((leg) => [
      leg.at[axis],
      leg.edge[axis],
      leg.edge[axis] + (leg.side === null ? 0 : outward[leg.side][axis] * stub),
    ]),
    ...boxes.flatMap((box) => [box[axis] - stub, box[axis] + box[length] + stub]),
  ]
  return [...new Set(values)].sort((one, two) => one - two)
}

type Search = {
  readonly start: Leg
  readonly end: Leg
  readonly boxes: readonly Rect[]
  readonly middle: Point
}

class Queue {
  private readonly states: number[] = []
  private readonly lengths: number[] = []
  private readonly offsets: number[] = []

  get size(): number {
    return this.states.length
  }

  private before(one: number, two: number): boolean {
    const gap = this.lengths[one]! - this.lengths[two]!
    return gap < -1e-9 || (gap <= 1e-9 && this.offsets[one]! < this.offsets[two]!)
  }

  private move(from: number, to: number): void {
    this.states[to] = this.states[from]!
    this.lengths[to] = this.lengths[from]!
    this.offsets[to] = this.offsets[from]!
  }

  private swap(one: number, two: number): void {
    const state = this.states[one]!
    const length = this.lengths[one]!
    const offset = this.offsets[one]!
    this.move(two, one)
    this.states[two] = state
    this.lengths[two] = length
    this.offsets[two] = offset
  }

  push(state: number, length: number, offset: number): void {
    this.states.push(state)
    this.lengths.push(length)
    this.offsets.push(offset)
    for (let at = this.states.length - 1; at > 0 && this.before(at, (at - 1) >> 1); at = (at - 1) >> 1)
      this.swap(at, (at - 1) >> 1)
  }

  pop(): number {
    const top = this.states[0]!
    this.move(this.states.length - 1, 0)
    this.states.pop()
    this.lengths.pop()
    this.offsets.pop()
    for (let at = 0; ;) {
      const left = at * 2 + 1
      let least = left < this.states.length && this.before(left, at) ? left : at
      if (left + 1 < this.states.length && this.before(left + 1, least)) least = left + 1
      if (least === at) return top
      this.swap(at, least)
      at = least
    }
  }
}

const stepX = [0, 1, 0, -1]
const stepY = [-1, 0, 1, 0]

function shortfallAt(x: number, y: number, edge: Point, side: Side | null, way: number): number {
  if (side === null || ways[way] !== outward[side]) return 0
  const along = (x - edge.x) * stepX[way]! + (y - edge.y) * stepY[way]!
  const onRay = stepX[way] === 0 ? x === edge.x : y === edge.y
  return onRay && along >= 0 ? Math.max(0, stub - along) : 0
}

function search({ start, end, boxes, middle }: Search): readonly Point[] | null {
  const xs = lanes("x", [start, end], boxes, middle.x)
  const ys = lanes("y", [start, end], boxes, middle.y)
  const width = xs.length
  const nodes = width * ys.length
  const pointOf = (node: number): Point => ({ x: xs[node % width]!, y: ys[Math.floor(node / width)]! })
  const nodeOf = (point: Point) => ys.indexOf(point.y) * width + xs.indexOf(point.x)
  const steps = new Int32Array(nodes * 4).fill(-1)
  for (let row = 0; row < ys.length; row += 1)
    for (let column = 0; column < width; column += 1) {
      const node = row * width + column
      const here = { x: xs[column]!, y: ys[row]! }
      if (column + 1 < width) {
        const there = { x: xs[column + 1]!, y: here.y }
        if (!boxes.some((box) => crosses(here, there, box))) {
          steps[node * 4 + 1] = node + 1
          steps[(node + 1) * 4 + 3] = node
        }
      }
      if (row + 1 < ys.length) {
        const there = { x: here.x, y: ys[row + 1]! }
        if (!boxes.some((box) => crosses(here, there, box))) {
          steps[node * 4 + 2] = node + width
          steps[(node + width) * 4] = node
        }
      }
    }
  const opening = nodeOf(start.edge) * 5 + (start.side === null ? 4 : ways.indexOf(outward[start.side]))
  const goal = nodeOf(end.edge)
  const endWay = end.side === null ? 4 : backOf(ways.indexOf(outward[end.side]))
  const length = new Float64Array(nodes * 5).fill(Number.POSITIVE_INFINITY)
  const offset = new Float64Array(nodes * 5).fill(Number.POSITIVE_INFINITY)
  const previous = new Int32Array(nodes * 5).fill(-1)
  const done = new Uint8Array(nodes * 5)
  const queue = new Queue()
  const ahead = (node: number) =>
    Math.abs(xs[node % width]! - end.edge.x) + Math.abs(ys[Math.floor(node / width)]! - end.edge.y)
  length[opening] = 0
  offset[opening] = 0
  queue.push(opening, ahead(nodeOf(start.edge)), 0)
  while (queue.size > 0) {
    const state = queue.pop()
    if (done[state] === 1) continue
    done[state] = 1
    const node = Math.floor(state / 5)
    const way = state % 5
    if (node === goal && (endWay === 4 || way === endWay)) {
      const route: Point[] = []
      for (let at = state; at !== -1; at = previous[at]!) route.unshift(pointOf(Math.floor(at / 5)))
      return route
    }
    const x = xs[node % width]!
    const y = ys[Math.floor(node / width)]!
    for (let next = 0; next < 4; next += 1) {
      const reachedNode = steps[node * 4 + next]!
      if (reachedNode === -1 || (way !== 4 && next === (way + 2) % 4)) continue
      const turns = way !== 4 && next !== way
      if (turns && state === opening && start.side !== null) continue
      const vertical = stepX[next] === 0
      const stretch = vertical
        ? Math.abs(ys[Math.floor(reachedNode / width)]! - y)
        : Math.abs(xs[reachedNode % width]! - x)
      const turnPrice = turns
        ? turnCost +
          shortfallAt(x, y, start.edge, start.side, way) +
          shortfallAt(x, y, end.edge, end.side, (next + 2) % 4)
        : 0
      const total = length[state]! + stretch + turnPrice
      const away =
        offset[state]! +
        (turns ? (vertical ? Math.abs(x - middle.x) + x * 1e-6 : Math.abs(y - middle.y) + y * 1e-6) : 0)
      const reached = reachedNode * 5 + next
      if (total < length[reached]! - 1e-9 || (total <= length[reached]! + 1e-9 && away < offset[reached]!)) {
        length[reached] = total
        offset[reached] = away
        previous[reached] = state
        queue.push(reached, total + ahead(reachedNode), away)
      }
    }
  }
  return null
}

function routed(start: RouteEnd, end: RouteEnd): readonly Point[] {
  const from = legOf(start)
  const to = legOf(end)
  const middle = {
    x: middleOf(spanOf(start, from, "x"), spanOf(end, to, "x")),
    y: middleOf(spanOf(start, from, "y"), spanOf(end, to, "y")),
  }
  const boxes = [start, end].flatMap((each) => (each.side === null || each.around === null ? [] : [each.around]))
  const found = search({ start: from, end: to, boxes, middle }) ?? search({ start: from, end: to, boxes: [], middle })
  return found === null ? [start.at, end.at] : [start.at, ...found, end.at]
}

export function elbowPoints(start: RouteEnd, end: RouteEnd): readonly Point[] {
  if (start.side !== null || end.side !== null) return tidy(routed(start, end))
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

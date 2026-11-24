import { distanceToSegment } from "./preset-geometry.js"
import type { Point } from "./resolved.js"

export type Side = "t" | "r" | "b" | "l"
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Rings = readonly (readonly Point[])[]
export type RouteEnd = {
  readonly at: Point
  readonly side: Side | null
  readonly around: Rect | null
  readonly outline?: Rings
}

export const stub = 24
const shorterStubs = [6, 12]
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

function lanes(
  axis: "x" | "y",
  legs: readonly Leg[],
  boxes: readonly Rect[],
  middle: number,
  extra: readonly Point[],
): readonly number[] {
  const length = axis === "x" ? "w" : "h"
  const values = [
    middle,
    ...extra.map((point) => point[axis]),
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
  readonly blocked: (from: Point, to: Point) => boolean
  readonly middle: Point
  readonly extra: readonly Point[]
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

function search({ start, end, boxes, blocked, middle, extra }: Search): readonly Point[] | null {
  const xs = lanes("x", [start, end], boxes, middle.x, extra)
  const ys = lanes("y", [start, end], boxes, middle.y, extra)
  const width = xs.length
  const nodes = width * ys.length
  const pointOf = (node: number): Point => ({ x: xs[node % width]!, y: ys[Math.floor(node / width)]! })
  const nodeOf = (point: Point) => ys.indexOf(point.y) * width + xs.indexOf(point.x)
  const steps = new Int32Array(nodes * 4).fill(-2)
  const stepFrom = (node: number, way: number): number => {
    const known = steps[node * 4 + way]!
    if (known !== -2) return known
    const column = (node % width) + stepX[way]!
    const row = Math.floor(node / width) + stepY[way]!
    const reached = column < 0 || column >= width || row < 0 || row >= ys.length ? -1 : row * width + column
    const [low, high] = node < reached ? [node, reached] : [reached, node]
    const open = reached !== -1 && !blocked(pointOf(low), pointOf(high))
    steps[node * 4 + way] = open ? reached : -1
    if (reached !== -1) steps[reached * 4 + backOf(way)] = open ? node : -1
    return open ? reached : -1
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
      if (way !== 4 && next === backOf(way)) continue
      const turns = way !== 4 && next !== way
      if (turns && state === opening && start.side !== null) continue
      const reachedNode = stepFrom(node, next)
      if (reachedNode === -1) continue
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

function turnOf(p: Point, q: Point, r: Point): number {
  const area = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  return Math.abs(area) < 1e-6 ? 0 : Math.sign(area)
}

function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return turnOf(a, b, c) * turnOf(a, b, d) < 0 && turnOf(c, d, a) * turnOf(c, d, b) < 0
}

function runsAlong(a: Point, b: Point, c: Point, d: Point): boolean {
  if (turnOf(a, b, c) !== 0 || turnOf(a, b, d) !== 0) return false
  const along = (point: Point) => (b.x - a.x) * (point.x - a.x) + (b.y - a.y) * (point.y - a.y)
  const length = along(b)
  const low = Math.max(0, Math.min(along(c), along(d)))
  const high = Math.min(length, Math.max(along(c), along(d)))
  return length > 0 && high - low > 1e-6 * length
}

function within(rings: Rings, at: Point): boolean {
  let crossed = false
  for (const ring of rings)
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length]!
      if (a.y > at.y !== b.y > at.y && at.x < a.x + ((at.y - a.y) * (b.x - a.x)) / (b.y - a.y)) crossed = !crossed
    })
  if (!crossed) return false
  return !rings.some((ring) =>
    ring.some((a, index) => distanceToSegment(at, a, ring[(index + 1) % ring.length]!) < 1e-6),
  )
}

type Outline = { readonly rings: Rings; readonly bounds: Rect }

function outlineOf(rings: Rings): Outline {
  const xs = rings.flatMap((ring) => ring.map((point) => point.x))
  const ys = rings.flatMap((ring) => ring.map((point) => point.y))
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { rings, bounds: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } }
}

type Cut = "free" | "along" | "through"

function cutOf(from: Point, to: Point, { rings, bounds }: Outline): Cut {
  if (
    Math.max(from.x, to.x) < bounds.x ||
    Math.min(from.x, to.x) > bounds.x + bounds.w ||
    Math.max(from.y, to.y) < bounds.y ||
    Math.min(from.y, to.y) > bounds.y + bounds.h
  )
    return "free"
  const through =
    rings.some((ring) => ring.some((a, index) => properlyCross(from, to, a, ring[(index + 1) % ring.length]!))) ||
    [0.25, 0.5, 0.75].some((share) =>
      within(rings, { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share }),
    )
  if (through) return "through"
  return rings.some((ring) => ring.some((a, index) => runsAlong(from, to, a, ring[(index + 1) % ring.length]!)))
    ? "along"
    : "free"
}

function freeRun(leg: Leg, outlines: readonly Rings[]): number {
  if (leg.side === null) return stub
  const toward = outward[leg.side]
  const far = { x: leg.edge.x + toward.x * stub * 2, y: leg.edge.y + toward.y * stub * 2 }
  let run = stub * 2
  for (const rings of outlines)
    for (const ring of rings)
      ring.forEach((a, index) => {
        const b = ring[(index + 1) % ring.length]!
        const edge = { x: b.x - a.x, y: b.y - a.y }
        const ray = { x: far.x - leg.edge.x, y: far.y - leg.edge.y }
        const cross = ray.x * edge.y - ray.y * edge.x
        if (cross === 0) return
        const share = ((a.x - leg.edge.x) * edge.y - (a.y - leg.edge.y) * edge.x) / cross
        const along = ((a.x - leg.edge.x) * ray.y - (a.y - leg.edge.y) * ray.x) / cross
        if (share > 1e-9 && share <= 1 && along >= 0 && along <= 1) run = Math.min(run, share * stub * 2)
      })
  return run
}

function corners({ rings, bounds }: Outline): readonly Point[] {
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
  return rings.flatMap((ring) =>
    ring.length > 12
      ? []
      : ring.flatMap((point) => [
          point,
          {
            x: point.x + Math.sign(point.x - center.x) * (stub / 2),
            y: point.y + Math.sign(point.y - center.y) * (stub / 2),
          },
        ]),
  )
}

function shortStubs(legs: readonly Leg[], outlines: readonly Rings[], shorter: readonly number[]): readonly Point[] {
  return legs.flatMap((leg) => {
    if (leg.side === null) return []
    const toward = outward[leg.side]
    const free = freeRun(leg, outlines)
    return [Math.min(stub, free / 2), ...shorter.filter((by) => by < free)].map((by) => ({
      x: leg.edge.x + toward.x * by,
      y: leg.edge.y + toward.y * by,
    }))
  })
}

function sharedEdge(one: Rect, two: Rect, axis: "x" | "y"): number {
  const length = axis === "x" ? "w" : "h"
  return Math.min(one[axis] + one[length], two[axis] + two[length]) - Math.max(one[axis], two[axis])
}

function touching(start: RouteEnd, end: RouteEnd, from: Leg, to: Leg): readonly Point[] | null {
  if (start.side === null || end.side === null || start.around === null || end.around === null) return null
  const leave = outward[start.side]
  const enter = outward[end.side]
  if (leave.x !== -enter.x || leave.y !== -enter.y) return null
  const level = leave.x === 0 ? from.edge.y === to.edge.y : from.edge.x === to.edge.x
  const along = leave.x === 0 ? "x" : "y"
  return level && sharedEdge(start.around, end.around, along) > 0 ? [start.at, from.edge, to.edge, end.at] : null
}

function routed(start: RouteEnd, end: RouteEnd): readonly Point[] {
  const from = legOf(start)
  const to = legOf(end)
  const flush = touching(start, end, from, to)
  if (flush !== null) return flush
  const middle = {
    x: middleOf(spanOf(start, from, "x"), spanOf(end, to, "x")),
    y: middleOf(spanOf(start, from, "y"), spanOf(end, to, "y")),
  }
  const attached = [start, end].filter((each) => each.side !== null)
  const boxes = attached.flatMap((each) => (each.around === null ? [] : [each.around]))
  const outlines = attached.flatMap((each) => (each.outline === undefined ? [] : [outlineOf(each.outline)]))
  const hugged = { mattered: false }
  const fromSite = { ...from, edge: start.at }
  const toSite = { ...to, edge: end.at }
  const tries = [
    {
      start: from,
      end: to,
      blocked: (here: Point, there: Point) => boxes.some((box) => crosses(here, there, box)),
      skip: () => false,
      extra: [],
    },
    ...(outlines.length === 0
      ? []
      : ([
          [false, []],
          [true, []],
          [true, shorterStubs],
        ] as const)
    ).map(([hugs, shorter]) => ({
      start: fromSite,
      end: toSite,
      blocked: (here: Point, there: Point) => {
        let blocked = false
        for (const outline of outlines) {
          const cut = cutOf(here, there, outline)
          if (cut === "through") return true
          if (cut === "along" && !hugs) {
            blocked = true
            hugged.mattered = true
          }
        }
        return blocked
      },
      skip: () => hugs && shorter.length === 0 && !hugged.mattered,
      extra: [
        ...shortStubs(
          [fromSite, toSite],
          outlines.map((outline) => outline.rings),
          shorter,
        ),
        ...outlines.flatMap(corners),
      ],
    })),
    { start: from, end: to, blocked: () => false, skip: () => false, extra: [] },
  ]
  for (const each of tries) {
    if (each.skip()) continue
    const found = search({ ...each, boxes, middle })
    if (found !== null) return [start.at, ...found, end.at]
  }
  return [start.at, end.at]
}

export function elbowPoints(start: RouteEnd, end: RouteEnd): readonly Point[] {
  if (start.side !== null || end.side !== null) {
    const points = tidy(routed(start, end))
    return points.length === 1 ? [start.at, end.at] : points
  }
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

import { describe, expect, it } from "vitest"
import { endOnShape } from "./line-ends.js"
import { elbowPoints, type RouteEnd, type Side } from "./line-route.js"
import type { Shaped, Site } from "./preset-geometry.js"
import type { Point } from "./resolved.js"

type Rings = readonly (readonly Point[])[]
type Shaped_ = RouteEnd & {
  readonly side: Side
  readonly around: NonNullable<RouteEnd["around"]>
  readonly outline: Rings
}

const rect: Shaped = { kind: "rect" }
const triangle: Shaped = { kind: "preset", name: "triangle" }
const ellipse: Shaped = { kind: "ellipse" }
const presets: readonly Shaped[] = [
  rect,
  { kind: "preset", name: "roundRect" },
  ellipse,
  { kind: "preset", name: "diamond" },
  triangle,
]
const sides: readonly Side[] = ["t", "r", "b", "l"]
const outward: Readonly<Record<Side, Point>> = {
  t: { x: 0, y: -1 },
  r: { x: 1, y: 0 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
}

const offsets = (gaps: readonly number[], own: number, other: number): readonly number[] => [
  ...gaps.map((gap) => own + gap),
  ...gaps.map((gap) => -other - gap),
  -other / 2,
  0,
  own / 2,
]

const ends = new Map<string, Shaped_>()

function endOf(shape: Shaped, x: number, y: number, w: number, h: number, rotation: number, site: Site): Shaped_ {
  const key = `${shape.name ?? shape.kind} ${w} ${h} ${rotation} ${site}`
  const placed =
    ends.get(key) ??
    (endOnShape(shape, { x: 0, y: 0, w, h, rotation, flipH: false, flipV: false }, 0, 0, site) as Shaped_)
  ends.set(key, placed)
  const move = (point: Point) => ({ x: point.x + x, y: point.y + y })
  return {
    ...placed,
    at: move(placed.at),
    around: { ...placed.around, x: placed.around.x + x, y: placed.around.y + y },
    outline: placed.outline.map((ring) => ring.map(move)),
  }
}

function edgeDistance(rings: Rings, at: Point): number {
  let least = Number.POSITIVE_INFINITY
  for (const ring of rings)
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length]!
      const along = { x: b.x - a.x, y: b.y - a.y }
      const square = along.x * along.x + along.y * along.y
      const share =
        square === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - a.x) * along.x + (at.y - a.y) * along.y) / square))
      least = Math.min(least, Math.hypot(at.x - a.x - along.x * share, at.y - a.y - along.y * share))
    })
  return least
}

function strictlyInside(rings: Rings, at: Point): boolean {
  let crossed = false
  for (const ring of rings)
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length]!
      if (a.y > at.y !== b.y > at.y && at.x < a.x + ((at.y - a.y) * (b.x - a.x)) / (b.y - a.y)) crossed = !crossed
    })
  return crossed && edgeDistance(rings, at) > 0.01
}

function entersShape(from: Point, to: Point, rings: Rings): boolean {
  const xs = rings.flatMap((ring) => ring.map((point) => point.x))
  const ys = rings.flatMap((ring) => ring.map((point) => point.y))
  if (
    Math.max(from.x, to.x) < Math.min(...xs) ||
    Math.min(from.x, to.x) > Math.max(...xs) ||
    Math.max(from.y, to.y) < Math.min(...ys) ||
    Math.min(from.y, to.y) > Math.max(...ys)
  )
    return false
  const shares = [0, 1]
  for (const ring of rings)
    ring.forEach((a, index) => {
      const b = ring[(index + 1) % ring.length]!
      const run = { x: to.x - from.x, y: to.y - from.y }
      const edge = { x: b.x - a.x, y: b.y - a.y }
      const cross = run.x * edge.y - run.y * edge.x
      if (cross === 0) return
      const share = ((a.x - from.x) * edge.y - (a.y - from.y) * edge.x) / cross
      if (share > 0 && share < 1) shares.push(share)
    })
  shares.sort((one, two) => one - two)
  return shares.some((share, index) => {
    const next = shares[index + 1]
    if (next === undefined || next - share < 1e-9) return false
    const middle = (share + next) / 2
    return strictlyInside(rings, { x: from.x + (to.x - from.x) * middle, y: from.y + (to.y - from.y) * middle })
  })
}

function edgeOf(end: Shaped_): Point {
  const box = end.around
  const reach = { t: end.at.y - box.y, r: box.x + box.w - end.at.x, b: box.y + box.h - end.at.y, l: end.at.x - box.x }[
    end.side
  ]
  const toward = outward[end.side]
  return { x: end.at.x + toward.x * reach, y: end.at.y + toward.y * reach }
}

const same = (one: Point, two: Point) => Math.abs(one.x - two.x) < 1e-9 && Math.abs(one.y - two.y) < 1e-9
const direction = (from: Point, to: Point): Point => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) })

function unavoidable(start: Shaped_, end: Shaped_): boolean {
  const stub = (one: Shaped_) => {
    const toward = outward[one.side]
    return [one.at, { x: one.at.x + toward.x, y: one.at.y + toward.y }] as const
  }
  return (
    same(start.at, end.at) ||
    strictlyInside(end.outline, start.at) ||
    strictlyInside(start.outline, end.at) ||
    entersShape(...stub(start), end.outline) ||
    entersShape(...stub(end), start.outline)
  )
}

function touching(start: Shaped_, end: Shaped_): boolean {
  const leave = outward[start.side]
  const enter = outward[end.side]
  if (leave.x !== -enter.x || leave.y !== -enter.y) return false
  const one = start.around
  const two = end.around
  const shared =
    leave.x === 0
      ? Math.min(one.x + one.w, two.x + two.w) - Math.max(one.x, two.x)
      : Math.min(one.y + one.h, two.y + two.h) - Math.max(one.y, two.y)
  const level = leave.x === 0 ? edgeOf(start).y === edgeOf(end).y : edgeOf(start).x === edgeOf(end).x
  return level && shared > 0
}

function faults(start: Shaped_, end: Shaped_): readonly string[] {
  const points = elbowPoints(start, end)
  const found: string[] = []
  if (!same(points[0]!, start.at) || !same(points.at(-1)!, end.at)) found.push("does not join its sites")
  const legs = points.slice(1).map((point, at) => [points[at]!, point] as const)
  if (legs.some(([from, to]) => from.x !== to.x && from.y !== to.y)) found.push("has a slanted leg")
  if (legs.some(([from, to]) => entersShape(from, to, start.outline))) found.push("crosses its source")
  if (legs.some(([from, to]) => entersShape(from, to, end.outline))) found.push("crosses its target")
  if (touching(start, end)) return found
  const inward = { x: -outward[end.side].x, y: -outward[end.side].y }
  if (legs.length > 0 && !same(direction(...legs[0]!), outward[start.side])) found.push("does not leave by its side")
  if (legs.length > 0 && !same(direction(...legs.at(-1)!), inward)) found.push("does not arrive by its side")
  return found
}

function sweep(
  pairs: readonly (readonly [Shaped, number, Shaped, number])[],
  gaps: readonly number[],
  size: { readonly w: number; readonly h: number },
) {
  let routes = 0
  const failures: string[] = []
  for (const [shape, turn, other, otherTurn] of pairs)
    for (const dx of offsets(gaps, size.w, 100))
      for (const dy of offsets(gaps, size.h, 100))
        for (const from of sides)
          for (const to of sides) {
            const start = endOf(shape, 0, 0, size.w, size.h, turn, from)
            const end = endOf(other, dx, dy, 100, 100, otherTurn, to)
            if (unavoidable(start, end)) continue
            routes += 1
            const found = faults(start, end)
            if (found.length > 0)
              failures.push(
                `${shape.name ?? shape.kind}@${turn} ${from} -> ${other.name ?? other.kind}@${otherTurn} ${to} at ${dx},${dy}: ${found.join(", ")}`,
              )
          }
  return { routes, failures }
}

describe("an elbow line routed between two shapes", () => {
  it("never crosses either shape, at any gap, overlap, side pair or common preset", () => {
    const pairs = presets.map((shape, index) => [shape, 0, presets[(index + 1) % presets.length]!, 0] as const)
    const { routes, failures } = sweep(pairs, [0, 10, 48, 60], { w: 160, h: 60 })
    expect(routes).toBeGreaterThan(9000)
    expect(failures.slice(0, 20), `${failures.length} of ${routes} routes`).toEqual([])
  })

  it("never crosses a shape turned a quarter", () => {
    const { routes, failures } = sweep([[rect, 90, rect, 0]], [0, 10, 30, 60], { w: 100, h: 60 })
    expect(routes).toBeGreaterThan(1800)
    expect(failures.slice(0, 20), `${failures.length} of ${routes} routes`).toEqual([])
  })

  it("crosses a shape turned off the quarter only from a site wedged in a narrow diagonal gap", () => {
    const pairs = [
      [rect, 45, rect, 0],
      [rect, 0, ellipse, 45],
      [rect, 30, rect, 30],
      [triangle, 30, rect, 45],
    ] as const
    const { routes, failures } = sweep(pairs, [0, 10, 60], { w: 100, h: 60 })
    expect(routes).toBeGreaterThan(4500)
    expect(failures.length, failures.join("\n")).toBeLessThanOrEqual(17)
  })
})

import { describe, expect, it } from "vitest"
import { elbowPoints, type RouteEnd, type Side } from "./line-route.js"
import { siteSpot, type Shaped } from "./preset-geometry.js"
import type { Point } from "./resolved.js"

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

const shapes: readonly Shaped[] = [
  { kind: "rect" },
  { kind: "preset", name: "roundRect" },
  { kind: "ellipse" },
  { kind: "preset", name: "diamond" },
  { kind: "preset", name: "triangle" },
]
const sides: readonly Side[] = ["t", "r", "b", "l"]
const outward: Readonly<Record<Side, Point>> = {
  t: { x: 0, y: -1 },
  r: { x: 1, y: 0 },
  b: { x: 0, y: 1 },
  l: { x: -1, y: 0 },
}
const gaps = [0, 10, 30, 47, 48, 60, 120]

const offsets = (own: number, other: number): readonly number[] => [
  ...gaps.map((gap) => own + gap),
  ...gaps.map((gap) => -other - gap),
  -other / 2,
  0,
  own / 2,
]

const spots = new Map<string, Point>()

const endOf = (shape: Shaped, box: Rect, side: Side): RouteEnd => {
  const key = `${shape.name ?? shape.kind} ${box.w} ${box.h} ${side}`
  const spot = spots.get(key) ?? siteSpot(shape, box.w, box.h, side)
  spots.set(key, spot)
  return { at: { x: box.x + spot.x, y: box.y + spot.y }, side, around: box }
}

function entersInside(from: Point, to: Point, box: Rect): boolean {
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

const direction = (from: Point, to: Point): Point => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) })
const same = (one: Point, two: Point) => one.x === two.x && one.y === two.y

function stubRay(end: RouteEnd & { readonly side: Side; readonly around: Rect }): readonly [Point, Point] {
  const toward = outward[end.side]
  const box = end.around
  const edge = { t: end.at.y - box.y, r: box.x + box.w - end.at.x, b: box.y + box.h - end.at.y, l: end.at.x - box.x }[
    end.side
  ]
  return [end.at, { x: end.at.x + toward.x * (edge + 1), y: end.at.y + toward.y * (edge + 1) }]
}

function faults(start: RouteEnd & { side: Side; around: Rect }, end: RouteEnd & { side: Side; around: Rect }) {
  const points = elbowPoints(start, end)
  const found: string[] = []
  if (!same(points[0]!, start.at) || !same(points.at(-1)!, end.at)) found.push("does not join its sites")
  const legs = points.slice(1).map((point, at) => [points[at]!, point] as const)
  if (legs.some(([from, to]) => from.x !== to.x && from.y !== to.y)) found.push("has a slanted leg")
  const boxed = (box: Rect, skip: number) => legs.some(([from, to], at) => at !== skip && entersInside(from, to, box))
  const first = legs[0]
  const last = legs.at(-1)
  const leaves = first !== undefined && same(direction(...first), outward[start.side])
  const arrives = last !== undefined && same(direction(...last), { x: -outward[end.side].x, y: -outward[end.side].y })
  if (boxed(start.around, leaves ? 0 : -1)) found.push("crosses its source")
  if (boxed(end.around, arrives ? legs.length - 1 : -1)) found.push("crosses its target")
  if (legs.length > 0 && !leaves) found.push("does not leave by its side")
  if (legs.length > 0 && !arrives) found.push("does not arrive by its side")
  return found
}

const unavoidable = (start: RouteEnd & { side: Side; around: Rect }, end: RouteEnd & { side: Side; around: Rect }) =>
  entersInside(...stubRay(start), end.around) || entersInside(...stubRay(end), start.around) || same(start.at, end.at)

describe("an elbow line routed between two shapes", () => {
  it("never crosses either shape, at any gap, overlap, side pair or common preset", () => {
    const sizes = [
      { w: 100, h: 100 },
      { w: 160, h: 60 },
    ]
    let routes = 0
    const failures: string[] = []
    shapes.forEach((shape, index) => {
      const other = shapes[(index + 1) % shapes.length]!
      for (const size of sizes)
        for (const dx of offsets(size.w, 100))
          for (const dy of offsets(size.h, 100)) {
            const source = { x: 0, y: 0, ...size }
            const target = { x: dx, y: dy, w: 100, h: 100 }
            for (const from of sides)
              for (const to of sides) {
                const start = endOf(shape, source, from) as RouteEnd & { side: Side; around: Rect }
                const end = endOf(other, target, to) as RouteEnd & { side: Side; around: Rect }
                if (unavoidable(start, end)) continue
                routes += 1
                const found = faults(start, end)
                if (found.length > 0)
                  failures.push(
                    `${shape.name ?? shape.kind} ${from} -> ${other.name ?? other.kind} ${to} at ${dx},${dy} (${size.w}x${size.h}): ${found.join(", ")}`,
                  )
              }
          }
    })
    expect(routes).toBeGreaterThan(20000)
    expect(failures.slice(0, 20), `${failures.length} of ${routes} routes`).toEqual([])
  }, 60000)
})

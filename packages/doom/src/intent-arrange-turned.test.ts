import { describe, expect, it } from "vitest"
import type { Doom } from "./doom.js"
import { doomFromTree } from "./doom-tree.js"
import { childrenOf, parentOf, propOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import type { Intent } from "./intent-read.js"
import { apply, identity } from "./matrix.js"
import { placeSlide } from "./place-slide.js"
import type { Point } from "./resolved.js"
import { build as built, started } from "./testing/agent-fixtures.js"
import { measure, plainTheme, row, spot } from "./testing/doom-fixtures-art.js"

const turned = (x: number, y: number, w: number, h: number, rotation: number) => ({ ...spot(x, y, w, h), rotation })

const freeLine = (start: Point, end: Point) => ({
  box: spot(0, 0, 10, 10),
  geometry: { kind: "line" as const, start, end, route: "straight" as const, arrows: ["none", "none"] as const },
})

function turnedDeck() {
  return doomFromTree({
    theme: plainTheme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "holder",
            props: { box: turned(200, 100, 600, 400, 30) },
            children: [
              { type: "shape", name: "a", props: { box: turned(40, 60, 120, 80, 45) } },
              { type: "shape", name: "b", props: { box: spot(300, 200, 100, 50) } },
              { type: "shape", name: "wire", props: freeLine({ x: 50, y: 300 }, { x: 250, y: 350 }) },
              {
                type: "frame",
                name: "inner",
                props: { box: turned(330, 40, 240, 160, -20) },
                children: [
                  { type: "shape", name: "k", props: { box: turned(10, 10, 50, 40, 15) } },
                  { type: "shape", name: "tie", props: freeLine({ x: 20, y: 120 }, { x: 200, y: 140 }) },
                ],
              },
              { type: "shape", name: "c", props: { box: spot(400, 300, 60, 60) } },
            ],
          },
        ],
      },
    ],
  })
}

const kids = (doom: Doom, id: NodeId) => childrenOf(doom, id).map((node) => node.id)

function painted(doom: Doom, slide: NodeId, id: NodeId): readonly Point[] {
  const placed = placeSlide(doom, slide, measure)
  const line = propOf(doom.nodes.get(id), "geometry")
  if (line?.kind !== "line") return placed.get(id)!.corners
  const content = placed.get(parentOf(doom.nodes.get(id))!.id)?.content ?? identity
  return [line.start, line.end].map((end) => ("node" in end ? { x: 0, y: 0 } : apply(content, end)))
}

function expectStill(before: readonly Point[], after: readonly Point[]) {
  expect(after).toHaveLength(before.length)
  after.forEach((point, at) => {
    expect(Math.abs(point.x - before[at]!.x)).toBeLessThan(1)
    expect(Math.abs(point.y - before[at]!.y)).toBeLessThan(1)
  })
}

const change = (value: Record<string, unknown>) => value as Intent
const build = (doom: Doom, intent: Intent) => built(started(doom), intent)

describe("wrap and unwrap keep turned layers and free lines where they painted", () => {
  it("wraps a turned shape and a free line inside a turned frame, at the frontmost member's place", () => {
    const grown = turnedDeck()
    const slide = grown.slides[0]!
    const { holder, a, b, wire, inner, c } = grown.ids as Record<string, NodeId>
    const wrapped = build(grown.doom, change({ op: "group", targets: [a, wire] }))
    const frame = kids(wrapped, holder!).find((id) => !Object.values(grown.ids).includes(id))!
    expect(kids(wrapped, holder!)).toEqual([b, frame, inner, c])
    expect(kids(wrapped, frame)).toEqual([a, wire])
    expectStill(painted(grown.doom, slide, a!), painted(wrapped, slide, a!))
    expectStill(painted(grown.doom, slide, wire!), painted(wrapped, slide, wire!))
    expect(propOf(wrapped.nodes.get(frame), "box")).toMatchObject({ x: 29, y: 29, w: 221, h: 321, rotation: 0 })
  })

  it("unwraps a turned frame inside a turned frame into its parent's space", () => {
    const grown = turnedDeck()
    const slide = grown.slides[0]!
    const { holder, b, wire, inner, a, c, k, tie } = grown.ids as Record<string, NodeId>
    const unwrapped = build(grown.doom, change({ op: "ungroup", target: inner }))
    expect(kids(unwrapped, holder!)).toEqual([a, b, wire, k, tie, c])
    expect(propOf(unwrapped.nodes.get(k!), "box")?.rotation).toBe(355)
    expectStill(painted(grown.doom, slide, k!), painted(unwrapped, slide, k!))
    expectStill(painted(grown.doom, slide, tie!), painted(unwrapped, slide, tie!))
  })

  it("unwraps what it wrapped back to where every layer painted", () => {
    const grown = turnedDeck()
    const slide = grown.slides[0]!
    const { holder, a, b, wire, inner, c } = grown.ids as Record<string, NodeId>
    const wrapped = build(grown.doom, change({ op: "group", targets: [a, wire] }))
    const frame = kids(wrapped, holder!)[1]!
    const back = built(wrapped, change({ op: "ungroup", target: frame }))
    expect(kids(back, holder!)).toEqual([b, a, wire, inner, c])
    for (const id of [a, wire]) expectStill(painted(grown.doom, slide, id!), painted(back, slide, id!))
  })

  it("unwraps a row at the boxes its layout solved, with the solved sizes", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            {
              type: "frame",
              name: "line-up",
              props: { box: spot(100, 100, 300, 50), layout: row({}, 10) },
              children: [
                { type: "shape", name: "one", props: { box: spot(500, 500, 40, 30) } },
                {
                  type: "shape",
                  name: "two",
                  props: { box: spot(500, 500, 40, 30), sizing: { w: "fill", h: "fixed" } },
                },
              ],
            },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const { one, two } = grown.ids as Record<string, NodeId>
    const unwrapped = build(grown.doom, change({ op: "ungroup", target: grown.ids["line-up"] }))
    expect(kids(unwrapped, slide)).toEqual([one, two])
    expect(propOf(unwrapped.nodes.get(one!), "box")).toMatchObject({ x: 100, y: 100, w: 40, h: 30 })
    expect(propOf(unwrapped.nodes.get(two!), "box")).toMatchObject({ x: 150, y: 100, w: 250, h: 30 })
    for (const id of [one, two]) expectStill(painted(grown.doom, slide, id!), painted(unwrapped, slide, id!))
  })
})

describe("move keeps a layer where it painted across turned frames", () => {
  it("moves a turned shape into a nested turned frame", () => {
    const grown = turnedDeck()
    const slide = grown.slides[0]!
    const { a, inner } = grown.ids as Record<string, NodeId>
    const moved = build(grown.doom, change({ op: "move", targets: [a], parent: inner }))
    expect(parentOf(moved.nodes.get(a!))?.id).toBe(inner)
    expectStill(painted(grown.doom, slide, a!), painted(moved, slide, a!))
  })

  it("moves a free line out of a turned frame onto the slide and carries both ends", () => {
    const grown = turnedDeck()
    const slide = grown.slides[0]!
    const { tie } = grown.ids as Record<string, NodeId>
    const moved = build(grown.doom, change({ op: "move", targets: [tie], parent: slide }))
    expect(parentOf(moved.nodes.get(tie!))?.id).toBe(slide)
    expectStill(painted(grown.doom, slide, tie!), painted(moved, slide, tie!))
  })

  it("keeps a line's attached end on its shape when the line moves", () => {
    const grown = doomFromTree({
      theme: plainTheme,
      slides: [
        {
          children: [
            { type: "frame", name: "room", props: { box: turned(300, 200, 200, 200, 60) } },
            { type: "shape", name: "post", props: { box: spot(50, 50, 40, 40) } },
            {
              type: "shape",
              name: "tether",
              props: (ids) => ({
                ...freeLine({ x: 0, y: 0 }, { x: 600, y: 500 }),
                geometry: {
                  ...freeLine({ x: 0, y: 0 }, { x: 600, y: 500 }).geometry,
                  start: { node: ids.post!, site: "r" as const },
                },
              }),
            },
          ],
        },
      ],
    })
    const slide = grown.slides[0]!
    const { room, post, tether } = grown.ids as Record<string, NodeId>
    const moved = build(grown.doom, change({ op: "move", targets: [tether], parent: room }))
    const line = propOf(moved.nodes.get(tether!), "geometry")
    expect(line).toMatchObject({ start: { node: post, site: "r" } })
    expectStill(painted(grown.doom, slide, tether!).slice(1), painted(moved, slide, tether!).slice(1))
  })
})

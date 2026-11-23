import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { duplicateWrites, pasteWrites } from "./copy-writes"
import { flipWrites, toggleWrites } from "./flip-writes"
import { wrapWrites, ungroupWrites } from "./group-writes"
import { orderWrites } from "./order-writes"
import { geometryOf } from "./slide-geometry"
import { grow, landed, paint, spot } from "./doom-fixtures"

function minter() {
  let next = 0
  return () => doom.nodeId(`m:${String((next += 1))}`)
}

const childrenOf = (view: doom.Doom, parent: doom.NodeId) => view.children.get(parent) ?? []
const regeometry = (view: doom.Doom, slide: doom.NodeId) =>
  geometryOf(doom.resolveSlide(view, slide, doom.measureWith({})))
const boxOf = (view: doom.Doom, id: doom.NodeId) => (view.nodes.get(id) as { box: ReturnType<typeof spot> }).box

const tree = [
  { type: "shape", name: "a", props: { box: spot(100, 100, 200, 100), fills: paint } },
  { type: "shape", name: "b", props: { box: spot(400, 300, 100, 100), fills: paint } },
  { type: "shape", name: "c", props: { box: spot(800, 100, 100, 100), fills: paint } },
] as const

describe("duplicate and paste", () => {
  it("copies a layer with a new id directly above it, props and all", () => {
    const built = grow(tree)
    const { ids, view, slides } = built
    const copies = duplicateWrites(view, [ids.a!], minter())
    const after = landed(view, copies.writes)
    const order = childrenOf(after, slides[0]!)
    expect(order).toHaveLength(4)
    expect(order.indexOf(copies.roots[0]!)).toBe(order.indexOf(ids.a!) + 1)
    expect(after.nodes.get(copies.roots[0]!)).toMatchObject({ type: "shape", name: "a", box: spot(100, 100, 200, 100) })
  })

  it("copies every layer inside a frame and keeps a line's ends tied to the copies", () => {
    const built = grow([
      {
        type: "frame",
        name: "card",
        props: { box: spot(100, 100, 600, 300), fills: paint },
        children: [
          { type: "shape", name: "one", props: { box: spot(0, 0, 100, 100), fills: paint } },
          { type: "shape", name: "two", props: { box: spot(200, 0, 100, 100), fills: paint } },
          {
            type: "shape",
            name: "link",
            props: {
              strokes: paint,
              geometry: {
                kind: "line",
                start: { node: doom.nodeId("n:5"), site: "r" },
                end: { node: doom.nodeId("n:6"), site: "l" },
                route: "straight",
                arrows: ["none", "arrow"],
              },
            },
          },
        ],
      },
    ])
    const copies = duplicateWrites(built.view, [built.ids.card!], minter())
    const after = landed(built.view, copies.writes)
    const [copy] = copies.roots
    const inner = childrenOf(after, copy!)
    expect(inner).toHaveLength(3)
    const line = after.nodes.get(inner[2]!) as { geometry: { start: { node: string }; end: { node: string } } }
    expect(line.geometry.start.node).toBe(inner[0])
    expect(line.geometry.end.node).toBe(inner[1])
  })

  it("pastes a copy of what was copied at the front of another parent", () => {
    const built = grow(tree)
    const mint = minter()
    const pasted = pasteWrites(
      { view: built.view, roots: [built.ids.b!, built.ids.c!] },
      built.view,
      built.slides[0]!,
      mint,
    )
    const after = landed(built.view, pasted.writes)
    const order = childrenOf(after, built.slides[0]!)
    expect(order.slice(-2)).toEqual(pasted.roots)
    expect(boxOf(after, pasted.roots[1]!)).toEqual(spot(800, 100, 100, 100))
  })
})

describe("group, frame and ungroup", () => {
  it("wraps layers in a hugging group whose box is their bounds, and keeps them where they were", () => {
    const built = grow(tree)
    const { ids, view, slides, geometry } = built
    const made = wrapWrites(view, geometry, [ids.a!, ids.b!], "group", minter())!
    const after = landed(view, made.writes)
    const group = made.selected[0]!
    expect(after.nodes.get(group)).toMatchObject({
      type: "frame",
      name: "Group",
      box: spot(100, 100, 400, 300),
      sizing: { w: "hug", h: "hug" },
    })
    expect(boxOf(after, ids.a!)).toEqual(spot(0, 0, 200, 100))
    expect(boxOf(after, ids.b!)).toEqual(spot(300, 200, 100, 100))
    expect(childrenOf(after, slides[0]!)).toEqual([group, ids.c!])
    expect(childrenOf(after, group)).toEqual([ids.a!, ids.b!])
    const still = regeometry(after, slides[0]!)
    expect(still.byId.get(ids.b!)?.bounds).toEqual(geometry.byId.get(ids.b!)?.bounds)
  })

  it("wraps in a clipping frame with no hug when asked for a frame", () => {
    const built = grow(tree)
    const made = wrapWrites(built.view, built.geometry, [built.ids.c!], "frame", minter())!
    const after = landed(built.view, made.writes)
    expect(after.nodes.get(made.selected[0]!)).toMatchObject({ name: "Frame", clip: true })
    expect(after.nodes.get(made.selected[0]!)).not.toHaveProperty("sizing")
  })

  it("will not wrap layers that live in different parents", () => {
    const built = grow([
      {
        type: "frame",
        name: "f",
        props: { box: spot(0, 0, 500, 500), fills: paint },
        children: [{ type: "shape", name: "x", props: { box: spot(0, 0, 10, 10), fills: paint } }],
      },
      { type: "shape", name: "y", props: { box: spot(600, 0, 10, 10), fills: paint } },
    ])
    expect(wrapWrites(built.view, built.geometry, [built.ids.x!, built.ids.y!], "group", minter())).toBeNull()
  })

  it("ungroup puts the layers back in the parent at the group's place, where they showed", () => {
    const built = grow(tree)
    const { ids, view, slides, geometry } = built
    const made = wrapWrites(view, geometry, [ids.a!, ids.b!], "group", minter())!
    const grouped = landed(view, made.writes)
    const again = ungroupWrites(grouped, regeometry(grouped, slides[0]!), made.selected)!
    const after = landed(grouped, again.writes)
    expect(again.selected).toEqual([ids.a!, ids.b!])
    expect(childrenOf(after, slides[0]!)).toEqual([ids.a!, ids.b!, ids.c!])
    expect(boxOf(after, ids.a!)).toEqual(spot(100, 100, 200, 100))
    expect(boxOf(after, ids.b!)).toEqual(spot(400, 300, 100, 100))
    expect((after.nodes.get(made.selected[0]!) as { parent: unknown }).parent).toBeNull()
  })

  it("ungroups a turned group by turning each layer with it", () => {
    const built = grow([
      {
        type: "frame",
        name: "g",
        props: { box: spot(400, 400, 200, 100, 90) },
        children: [{ type: "shape", name: "k", props: { box: spot(0, 0, 100, 100), fills: paint } }],
      },
    ])
    const before = built.geometry.byId.get(built.ids.k!)!.bounds
    const made = ungroupWrites(built.view, built.geometry, [built.ids.g!])!
    const after = landed(built.view, made.writes)
    const now = regeometry(after, built.slides[0]!).byId.get(built.ids.k!)!.bounds
    expect(now.left).toBeCloseTo(before.left, 0)
    expect(now.top).toBeCloseTo(before.top, 0)
    expect(boxOf(after, built.ids.k!).rotation).toBe(90)
  })

  it("does nothing to a layer that is not a frame", () => {
    const built = grow(tree)
    expect(ungroupWrites(built.view, built.geometry, [built.ids.a!])).toBeNull()
  })
})

describe("layer order", () => {
  const built = grow(tree)
  const run = (ids: readonly doom.NodeId[], how: Parameters<typeof orderWrites>[2]) =>
    childrenOf(landed(built.view, orderWrites(built.view, ids, how)), built.slides[0]!)

  it("moves to the front and to the back", () => {
    const { a, b, c } = built.ids
    expect(run([a!], "front")).toEqual([b, c, a])
    expect(run([c!], "back")).toEqual([c, a, b])
  })

  it("steps one layer forward and backward", () => {
    const { a, b, c } = built.ids
    expect(run([a!], "forward")).toEqual([b, a, c])
    expect(run([c!], "backward")).toEqual([a, c, b])
  })

  it("keeps the order of several layers moved together", () => {
    const { a, b, c } = built.ids
    expect(run([a!, c!], "front")).toEqual([b, a, c])
    expect(run([b!, c!], "backward")).toEqual([b, c, a])
  })

  it("writes nothing when the layer is already there", () => {
    const { a, c } = built.ids
    expect(orderWrites(built.view, [c!], "front")).toEqual([])
    expect(orderWrites(built.view, [a!], "back")).toEqual([])
    expect(orderWrites(built.view, [c!], "forward")).toEqual([])
  })
})

describe("flip, hide and lock", () => {
  it("flips a layer in place and turns a rotated one the other way", () => {
    const built = grow([{ type: "shape", name: "s", props: { box: spot(100, 100, 200, 100, 30), fills: paint } }])
    const after = landed(built.view, flipWrites(built.view, built.geometry, [built.ids.s!], "horizontal"))
    expect(boxOf(after, built.ids.s!)).toMatchObject({ x: 100, y: 100, flipH: true, flipV: false, rotation: 330 })
  })

  it("mirrors several layers about the middle of the selection", () => {
    const built = grow(tree)
    const { a, b } = built.ids
    const after = landed(built.view, flipWrites(built.view, built.geometry, [a!, b!], "horizontal"))
    expect(boxOf(after, a!)).toMatchObject({ x: 300, flipH: true })
    expect(boxOf(after, b!)).toMatchObject({ x: 100, flipH: true })
  })

  it("hides all, and shows all again once every one is hidden", () => {
    const built = grow(tree)
    const ids = [built.ids.a!, built.ids.b!]
    const hidden = landed(built.view, toggleWrites(built.view, ids, "hidden"))
    expect(hidden.nodes.get(ids[0]!)).toMatchObject({ hidden: true })
    const shown = landed(hidden, toggleWrites(hidden, ids, "hidden"))
    expect(shown.nodes.get(ids[0]!)).toMatchObject({ hidden: false })
  })
})

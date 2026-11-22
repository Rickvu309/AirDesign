import { describe, expect, it } from "vitest"
import { movable, movedBy, moveWrites } from "./move-writes"
import { grow, landed, paint, spot } from "./doom-fixtures"

const size = { w: 1920, h: 1080 }

describe("moving layers", () => {
  const tree = [
    { type: "shape", name: "a", props: { box: spot(100, 100, 200, 100), fills: paint } },
    { type: "shape", name: "b", props: { box: spot(600, 100, 200, 100), fills: paint } },
  ] as const

  it("writes one box per layer, keeping the size and rounding to whole pixels", () => {
    const { view, geometry, ids } = grow(tree)
    const writes = moveWrites(view, geometry, [ids.a!, ids.b!], { x: 10.4, y: -3.6 })
    expect(writes).toEqual([
      { node: ids.a, prop: "box", value: spot(110, 96, 200, 100) },
      { node: ids.b, prop: "box", value: spot(610, 96, 200, 100) },
    ])
  })

  it("writes nothing when the layer would not move", () => {
    const { view, geometry, ids } = grow(tree)
    expect(moveWrites(view, geometry, [ids.a!], { x: 0.2, y: 0 })).toEqual([])
  })

  it("moves a layer inside a rotated frame along the slide's axes, not the frame's", () => {
    const { view, geometry, ids } = grow([
      {
        type: "frame",
        name: "frame",
        props: { box: spot(500, 300, 400, 400, 90) },
        children: [{ type: "shape", name: "inner", props: { box: spot(50, 50, 100, 100), fills: paint } }],
      },
    ])
    const writes = moveWrites(view, geometry, [ids.inner!], { x: 0, y: 40 })
    expect(writes).toEqual([{ node: ids.inner, prop: "box", value: spot(90, 50, 100, 100) }])
  })

  it("will not move a locked layer, a layer in auto layout, or a line fixed at both ends", () => {
    const { view, ids } = grow([
      { type: "shape", name: "locked", props: { box: spot(0, 0, 10, 10), locked: true } },
      {
        type: "frame",
        name: "row",
        props: {
          box: spot(0, 100, 400, 100),
          layout: { mode: "row", gap: 8, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
        },
        children: [{ type: "shape", name: "flowing", props: { box: spot(0, 0, 50, 50), fills: paint } }],
      },
    ])
    expect(movable(view, ids.locked!)).toBe(false)
    expect(movable(view, ids.flowing!)).toBe(false)
    expect(movable(view, ids.row!)).toBe(true)
  })

  it("shifts both free ends of a line instead of its box", () => {
    const { view, geometry, ids } = grow([
      {
        type: "shape",
        name: "line",
        props: {
          strokes: paint,
          geometry: {
            kind: "line",
            start: { x: 10, y: 10 },
            end: { x: 110, y: 60 },
            route: "straight",
            arrows: ["none", "none"],
          },
        },
      },
    ])
    const [write] = moveWrites(view, geometry, [ids.line!], { x: 5, y: 7 })
    expect(write).toMatchObject({
      prop: "geometry",
      value: { start: { x: 15, y: 17 }, end: { x: 115, y: 67 } },
    })
  })

  it("snaps the moved layer's edge to a neighbour's edge within the reach and reports the guide", () => {
    const { view, geometry, ids } = grow(tree)
    const moved = movedBy({
      view,
      geometry,
      ids: [ids.a!],
      by: { x: 298, y: 1 },
      snap: true,
      lockAxis: false,
      scale: 1,
      size,
    })
    expect(moved.by.x).toBe(300)
    expect(moved.writes).toEqual([{ node: ids.a, prop: "box", value: spot(400, 100, 200, 100) }])
    expect(moved.guides.length).toBeGreaterThan(0)
  })

  it("does not snap when snapping is off", () => {
    const { view, geometry, ids } = grow(tree)
    const moved = movedBy({
      view,
      geometry,
      ids: [ids.a!],
      by: { x: 298, y: 1 },
      snap: false,
      lockAxis: false,
      scale: 1,
      size,
    })
    expect(moved.by).toEqual({ x: 298, y: 1 })
    expect(moved.guides).toEqual([])
  })

  it("keeps a lone axis when Shift locks the move to its longer direction", () => {
    const { view, geometry, ids } = grow(tree)
    const moved = movedBy({
      view,
      geometry,
      ids: [ids.a!],
      by: { x: 40, y: 9 },
      snap: false,
      lockAxis: true,
      scale: 1,
      size,
    })
    expect(moved.by).toEqual({ x: 40, y: 0 })
  })

  it("lands as one edit that the doom accepts", () => {
    const { view, geometry, ids } = grow(tree)
    const after = landed(view, moveWrites(view, geometry, [ids.a!, ids.b!], { x: 20, y: 0 }))
    expect(after.nodes.get(ids.a!)).toMatchObject({ box: spot(120, 100, 200, 100) })
  })
})

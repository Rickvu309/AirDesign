import { describe, expect, it } from "vitest"
import { apply } from "./slide-geometry"
import { grow, paint, spot } from "./testing/doom-fixtures"

const tree = [
  { type: "shape", name: "under", props: { box: spot(0, 0, 100, 100), fills: paint } },
  {
    type: "shape",
    name: "round",
    props: { box: spot(100, 100, 200, 200), fills: paint, mask: true, geometry: { kind: "ellipse" } },
  },
  { type: "shape", name: "clipped", props: { box: spot(0, 0, 400, 400), fills: paint } },
  {
    type: "shape",
    name: "pill",
    props: { box: { ...spot(500, 0, 100, 100), flipH: true }, fills: paint, mask: true, radius: [40, 0, 0, 0] },
  },
  { type: "shape", name: "badge", props: { box: spot(480, 0, 200, 200), fills: paint } },
  {
    type: "frame",
    name: "group",
    props: { box: spot(1000, 500, 300, 300) },
    children: [
      { type: "shape", name: "hole", props: { box: spot(10, 20, 100, 50), fills: paint, mask: true } },
      { type: "shape", name: "inner", props: { box: spot(0, 0, 300, 300), fills: paint } },
    ],
  },
] as const

describe("what each placed layer reveals and paints through", () => {
  const { geometry, ids } = grow(tree)
  const placed = (name: keyof typeof ids) => geometry.byId.get(ids[name])!

  it("gives a mask its own outline and the layers above it that outline", () => {
    expect(placed("round").reveals?.d).toBe("M0 100A100 100 0 1 0 200 100A100 100 0 1 0 0 100Z")
    expect(placed("clipped").maskedBy).toEqual(placed("round").reveals)
    expect(placed("under").maskedBy).toBeNull()
    expect(placed("under").reveals).toBeNull()
  })

  it("does not clip a second mask by the first", () => {
    expect(placed("pill").maskedBy).toBeNull()
    expect(placed("badge").maskedBy).toEqual(placed("pill").reveals)
  })

  it("mirrors a flipped mask's outline the way it paints", () => {
    const pill = placed("pill").reveals!
    expect(apply(pill.matrix, { x: 0, y: 0 })).toEqual({ x: 600, y: 0 })
    expect(apply(pill.matrix, { x: 100, y: 0 })).toEqual({ x: 500, y: 0 })
  })

  it("places a mask inside a frame in slide coordinates", () => {
    const hole = placed("hole").reveals!
    expect(apply(hole.matrix, { x: 0, y: 0 })).toEqual({ x: 1010, y: 520 })
    expect(placed("inner").maskedBy).toEqual(hole)
  })
})

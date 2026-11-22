import { describe, expect, it } from "vitest"
import { grow, landed, paint, spot } from "./doom-fixtures"
import { transformedBy, type TransformInput } from "./transform-drag"

const size = { w: 1920, h: 1080 }

function input(
  built: ReturnType<typeof grow>,
  ids: readonly string[],
  grip: TransformInput["grip"],
  origin: { x: number; y: number },
  at: { x: number; y: number },
  extra: Partial<TransformInput> = {},
): TransformInput {
  return {
    view: built.view,
    geometry: built.geometry,
    ids: ids as TransformInput["ids"],
    grip,
    origin,
    at,
    keepRatio: false,
    fromCenter: false,
    snapAngle: false,
    snap: false,
    scale: 1,
    size,
    ...extra,
  }
}

const boxOf = (writes: ReturnType<typeof transformedBy>["writes"], node: string) =>
  writes.find((write) => write.node === node && write.prop === "box")?.value

describe("resizing", () => {
  const built = grow([
    { type: "shape", name: "a", props: { box: spot(100, 100, 200, 100), fills: paint } },
    { type: "shape", name: "far", props: { box: spot(700, 100, 200, 100), fills: paint } },
  ])
  const { ids } = built

  it("moves the dragged corner and keeps the opposite one where it was", () => {
    const moved = transformedBy(input(built, [ids.a!], "bottom-right", { x: 300, y: 200 }, { x: 340, y: 230 }))
    expect(boxOf(moved.writes, ids.a!)).toEqual(spot(100, 100, 240, 130))
    expect(moved.label).toBe("240 × 130")
  })

  it("moves one edge only", () => {
    const moved = transformedBy(input(built, [ids.a!], "left", { x: 100, y: 150 }, { x: 60, y: 190 }))
    expect(boxOf(moved.writes, ids.a!)).toEqual(spot(60, 100, 240, 100))
  })

  it("grows both sides from the centre with Alt", () => {
    const moved = transformedBy(
      input(built, [ids.a!], "right", { x: 300, y: 150 }, { x: 320, y: 150 }, { fromCenter: true }),
    )
    expect(boxOf(moved.writes, ids.a!)).toEqual(spot(80, 100, 240, 100))
  })

  it("keeps the proportions of a corner drag with Shift", () => {
    const moved = transformedBy(
      input(built, [ids.a!], "bottom-right", { x: 300, y: 200 }, { x: 400, y: 210 }, { keepRatio: true }),
    )
    const box = boxOf(moved.writes, ids.a!) as { w: number; h: number }
    expect(box.w / box.h).toBeCloseTo(2, 1)
  })

  it("snaps the moving edge to a neighbour's edge and reports a guide", () => {
    const moved = transformedBy(input(built, [ids.a!], "right", { x: 300, y: 150 }, { x: 697, y: 150 }, { snap: true }))
    expect(boxOf(moved.writes, ids.a!)).toMatchObject({ w: 600 })
    expect(moved.guides.length).toBeGreaterThan(0)
  })

  it("does not snap with Control held", () => {
    const moved = transformedBy(
      input(built, [ids.a!], "right", { x: 300, y: 150 }, { x: 697, y: 150 }, { snap: false }),
    )
    expect(boxOf(moved.writes, ids.a!)).toMatchObject({ w: 597 })
    expect(moved.guides).toEqual([])
  })

  it("scales a selection of two layers as one frame", () => {
    const moved = transformedBy(input(built, [ids.a!, ids.far!], "right", { x: 900, y: 150 }, { x: 1700, y: 150 }))
    expect(boxOf(moved.writes, ids.a!)).toEqual(spot(100, 100, 400, 100))
    expect(boxOf(moved.writes, ids.far!)).toEqual(spot(1300, 100, 400, 100))
  })

  it("resizes along the layer's own axes when it is turned", () => {
    const turned = grow([{ type: "shape", name: "bar", props: { box: spot(500, 500, 200, 100, 90), fills: paint } }])
    const moved = transformedBy(input(turned, [turned.ids.bar!], "right", { x: 600, y: 650 }, { x: 600, y: 690 }))
    const box = boxOf(moved.writes, turned.ids.bar!) as { w: number; h: number; rotation: number }
    expect(box.w).toBe(240)
    expect(box.h).toBe(100)
    expect(box.rotation).toBe(90)
  })

  it("makes a hug size fixed on the axis it changed", () => {
    const hug = grow([
      {
        type: "frame",
        name: "card",
        props: { box: spot(100, 100, 200, 100), fills: paint, sizing: { w: "hug", h: "fixed" } },
      },
    ])
    const moved = transformedBy(input(hug, [hug.ids.card!], "bottom-right", { x: 300, y: 200 }, { x: 340, y: 200 }))
    expect(moved.writes.find((write) => write.prop === "sizing")?.value).toEqual({ w: "fixed", h: "fixed" })
  })

  it("turns auto-width text into auto height on a side drag and fixed on a corner drag", () => {
    const text = grow([
      {
        type: "shape",
        name: "words",
        props: {
          box: spot(100, 100, 200, 40),
          text: { chars: "Hello", spans: [], paras: [{}], style: "body", resize: "widthAndHeight", alignV: "top" },
        },
      },
    ])
    const side = transformedBy(input(text, [text.ids.words!], "right", { x: 300, y: 120 }, { x: 420, y: 120 }))
    expect(side.writes.find((write) => write.prop === "text")?.value).toMatchObject({ resize: "height" })
    const corner = transformedBy(input(text, [text.ids.words!], "bottom-right", { x: 300, y: 140 }, { x: 420, y: 200 }))
    expect(corner.writes.find((write) => write.prop === "text")?.value).toMatchObject({ resize: "fixed" })
  })

  it("scales what is inside a group and leaves the group hugging", () => {
    const group = grow([
      {
        type: "frame",
        name: "group",
        props: { box: spot(100, 100, 300, 100), sizing: { w: "hug", h: "hug" } },
        children: [
          { type: "shape", name: "left", props: { box: spot(0, 0, 100, 100), fills: paint } },
          { type: "shape", name: "right", props: { box: spot(200, 0, 100, 100), fills: paint } },
        ],
      },
    ])
    const moved = transformedBy(input(group, [group.ids.group!], "right", { x: 400, y: 150 }, { x: 700, y: 150 }))
    expect(boxOf(moved.writes, group.ids.group!)).toMatchObject({ w: 600 })
    expect(boxOf(moved.writes, group.ids.left!)).toMatchObject({ x: 0, w: 200 })
    expect(boxOf(moved.writes, group.ids.right!)).toMatchObject({ x: 400, w: 200 })
    expect(moved.writes.some((write) => write.prop === "sizing")).toBe(false)
  })

  it("lands as an edit the doom accepts", () => {
    const moved = transformedBy(input(built, [ids.a!], "bottom-right", { x: 300, y: 200 }, { x: 340, y: 230 }))
    expect(landed(built.view, moved.writes).nodes.get(ids.a!)).toMatchObject({ box: spot(100, 100, 240, 130) })
  })
})

describe("rotating", () => {
  const built = grow([
    { type: "shape", name: "a", props: { box: spot(100, 100, 200, 100), fills: paint } },
    { type: "shape", name: "b", props: { box: spot(500, 100, 200, 100), fills: paint } },
  ])
  const { ids } = built

  it("turns a layer by the angle the pointer sweeps around its centre", () => {
    const moved = transformedBy(input(built, [ids.a!], "rotate-top-right", { x: 300, y: 150 }, { x: 200, y: 250 }))
    expect(boxOf(moved.writes, ids.a!)).toMatchObject({ x: 100, y: 100, rotation: 90 })
    expect(moved.label).toBe("90°")
  })

  it("names the angle with at most one decimal", () => {
    const moved = transformedBy(input(built, [ids.a!], "rotate-top-right", { x: 300, y: 150 }, { x: 240, y: 20 }))
    expect(moved.label).toMatch(/^\d{1,3}(\.\d)?°$/)
  })

  it("steps by 15 degrees with Shift", () => {
    const moved = transformedBy(
      input(built, [ids.a!], "rotate-top-right", { x: 300, y: 150 }, { x: 290, y: 190 }, { snapAngle: true }),
    )
    expect((boxOf(moved.writes, ids.a!) as { rotation: number }).rotation % 15).toBe(0)
  })

  it("turns a selection about its middle, each layer keeping its own size", () => {
    const moved = transformedBy(
      input(built, [ids.a!, ids.b!], "rotate-top-right", { x: 700, y: 150 }, { x: 400, y: 450 }),
    )
    const first = boxOf(moved.writes, ids.a!) as { x: number; y: number; w: number; rotation: number }
    expect(first.w).toBe(200)
    expect(first.rotation).toBe(90)
    expect(first.x).not.toBe(100)
  })

  it("writes a layer inside a turned frame relative to the frame's own turn", () => {
    const nested = grow([
      {
        type: "frame",
        name: "frame",
        props: { box: spot(400, 400, 400, 400, 90) },
        children: [{ type: "shape", name: "inner", props: { box: spot(100, 100, 100, 100), fills: paint } }],
      },
    ])
    const placed = nested.geometry.byId.get(nested.ids.inner!)!
    const centre = {
      x: (placed.corners[0].x + placed.corners[2].x) / 2,
      y: (placed.corners[0].y + placed.corners[2].y) / 2,
    }
    const moved = transformedBy(
      input(
        nested,
        [nested.ids.inner!],
        "rotate-top-right",
        { x: centre.x + 50, y: centre.y },
        { x: centre.x, y: centre.y + 50 },
      ),
    )
    expect((boxOf(moved.writes, nested.ids.inner!) as { rotation: number }).rotation).toBe(90)
  })
})

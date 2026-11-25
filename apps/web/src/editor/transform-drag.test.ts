import { describe, expect, it } from "vitest"
import * as doom from "@airdesign/doom"
import { geometryOf } from "./slide-geometry"
import { grow, landed, paint, spot } from "./testing/doom-fixtures"
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

  it("keeps a cropped picture's aspect on an ordinary resize, and Control is the resize that stretches it", () => {
    const asset = "a".repeat(64)
    const crop = { x: 0.1, y: 0, w: 0.6, h: 0.75 }
    const picture = grow([
      {
        type: "shape",
        name: "photo",
        props: {
          box: spot(100, 100, 200, 100),
          fills: [{ kind: "image", asset, fit: "crop", crop }],
        },
      },
    ])
    const id = picture.ids.photo!
    const kept = transformedBy(input(picture, [id], "right", { x: 300, y: 150 }, { x: 380, y: 190 }))
    expect(boxOf(kept.writes, id)).toEqual(spot(100, 80, 280, 140))
    expect(kept.writes.map((write) => write.prop)).toEqual(["box"])
    const read = (writes: typeof kept.writes) => doom.readForAgent(landed(picture.view, writes), picture.slides)
    expect(read(kept.writes)).toContain(`fill=image:${asset}/crop(10,0,30,25)`)

    const stretched = transformedBy(
      input(picture, [id], "right", { x: 300, y: 150 }, { x: 380, y: 190 }, { breakAspect: true }),
    )
    expect(boxOf(stretched.writes, id)).toEqual(spot(100, 100, 280, 100))
    expect(read(stretched.writes)).toContain(`fill=image:${asset}/crop(10,0,30,25)`)
  })

  it("still resizes one edge of a picture that is not cropped", () => {
    const picture = grow([
      {
        type: "shape",
        name: "photo",
        props: {
          box: spot(100, 100, 200, 100),
          fills: [{ kind: "image", asset: "a".repeat(64), fit: "fill" }],
        },
      },
    ])
    const moved = transformedBy(input(picture, [picture.ids.photo!], "right", { x: 300, y: 150 }, { x: 380, y: 190 }))
    expect(boxOf(moved.writes, picture.ids.photo!)).toEqual(spot(100, 100, 280, 100))
  })

  it("lands as an edit the doom accepts", () => {
    const moved = transformedBy(input(built, [ids.a!], "bottom-right", { x: 300, y: 200 }, { x: 340, y: 230 }))
    expect(landed(built.view, moved.writes).nodes.get(ids.a!)).toMatchObject({ box: spot(100, 100, 240, 130) })
  })
})

describe("resizing a linked chart", () => {
  const minimum = doom.columnDefinition.spec.minFrame!
  const start = spot(200, 200, 800, 500)
  const placedChart = () => {
    const before = grow([])
    const frame = doom.nodeId("chart:1")
    const writes = doom.placeComponent(before.view, doom.columnDefinition, {
      frame,
      parent: { id: before.slides[0]!, at: doom.orderKeyBetween(null, null) },
      box: start,
      data: { rows: [{ id: "a", label: "Europe", value: 12 }] },
      measure: before.measure,
    })
    if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
    const view = landed(before.view, writes)
    const geometry = geometryOf(doom.resolveSlide(view, before.slides[0]!, before.measure))
    return { ...before, view, geometry, frame }
  }
  const chart = placedChart()

  it.each([
    { grip: "bottom-right", from: { x: 1000, y: 700 }, to: { x: 0, y: 0 }, box: spot(200, 200, minimum.w, minimum.h) },
    {
      grip: "top-left",
      from: { x: 200, y: 200 },
      to: { x: 1900, y: 1000 },
      box: spot(1000 - minimum.w, 700 - minimum.h, minimum.w, minimum.h),
    },
    {
      grip: "left",
      from: { x: 200, y: 450 },
      to: { x: 1900, y: 450 },
      box: spot(1000 - minimum.w, 200, minimum.w, 500),
    },
    { grip: "bottom", from: { x: 600, y: 700 }, to: { x: 600, y: 0 }, box: spot(200, 200, 800, minimum.h) },
  ] as const)("stops the $grip handle at the chart's minimum size", ({ grip, from, to, box }) => {
    const moved = transformedBy(input(chart, [chart.frame], grip, from, to))
    expect(boxOf(moved.writes, chart.frame)).toEqual(box)
    expect(doom.isRefusal(doom.prepareComponentEdit(chart.view, moved.writes, chart.measure))).toBe(false)
  })

  const legacy = (() => {
    const box = spot(500, 300, 110, 380)
    const instance = doom.propOf(chart.view.nodes.get(chart.frame), "instance")
    const view = landed(chart.view, [
      { node: chart.frame, prop: "box", value: box },
      { node: chart.frame, prop: "instance", value: instance },
    ])
    return { ...chart, view, geometry: geometryOf(doom.resolveSlide(view, chart.slides[0]!, chart.measure)) }
  })()

  it.each([
    { grip: "bottom", from: { x: 570, y: 680 }, to: { x: 570, y: 735 }, box: spot(500, 300, minimum.w, 435) },
    { grip: "top", from: { x: 570, y: 300 }, to: { x: 570, y: 245 }, box: spot(500, 245, minimum.w, 435) },
    { grip: "right", from: { x: 640, y: 490 }, to: { x: 695, y: 490 }, box: spot(500, 300, 195, 380) },
    { grip: "left", from: { x: 500, y: 490 }, to: { x: 445, y: 490 }, box: spot(445, 300, 195, 380) },
    { grip: "bottom-right", from: { x: 640, y: 680 }, to: { x: 650, y: 690 }, box: spot(500, 300, 150, 390) },
    { grip: "top-left", from: { x: 500, y: 300 }, to: { x: 490, y: 290 }, box: spot(490, 290, 150, 390) },
  ] as const)(
    "resizes a chart saved below its minimum from the size it paints, and stores at least the minimum, from the $grip handle",
    ({ grip, from, to, box }) => {
      expect(legacy.geometry.byId.get(legacy.frame)?.node.box).toMatchObject({ x: 500, y: 300, w: minimum.w, h: 380 })
      const moved = transformedBy(input(legacy, [legacy.frame], grip, from, to))
      expect(boxOf(moved.writes, legacy.frame)).toEqual(box)
      expect(doom.isRefusal(doom.prepareComponentEdit(legacy.view, moved.writes, legacy.measure))).toBe(false)
    },
  )

  it("keeps the proportions at the minimum with Shift", () => {
    const moved = transformedBy(
      input(chart, [chart.frame], "bottom-right", { x: 1000, y: 700 }, { x: 0, y: 0 }, { keepRatio: true }),
    )
    const box = boxOf(moved.writes, chart.frame) as { w: number; h: number }
    expect(box.w).toBeGreaterThanOrEqual(minimum.w)
    expect(box.h).toBeGreaterThanOrEqual(minimum.h)
    expect(box.w / box.h).toBeCloseTo(800 / 500, 1)
  })

  it("keeps a chart at its minimum inside a scaled selection", () => {
    const withShape = landed(chart.view, [
      { node: doom.nodeId("shape:9"), prop: "type", value: "shape" },
      {
        node: doom.nodeId("shape:9"),
        prop: "parent",
        value: { id: chart.slides[0]!, at: doom.orderKeyBetween(null, null) },
      },
      { node: doom.nodeId("shape:9"), prop: "box", value: spot(1100, 200, 200, 100) },
    ])
    const geometry = geometryOf(doom.resolveSlide(withShape, chart.slides[0]!, chart.measure))
    const moved = transformedBy(
      input(
        { ...chart, view: withShape, geometry },
        [chart.frame, "shape:9"],
        "right",
        { x: 1300, y: 450 },
        { x: 300, y: 450 },
      ),
    )
    expect(boxOf(moved.writes, chart.frame)).toMatchObject({ w: minimum.w })
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

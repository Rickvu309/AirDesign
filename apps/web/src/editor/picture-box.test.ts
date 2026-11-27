import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { intentWrites } from "./editor-intents"
import { pictureBox } from "./picture-box"
import { grow, landed } from "./testing/doom-fixtures"

const slideSize = { w: 1920, h: 1080 }
const asset = "a".repeat(64)

describe("where a dropped picture lands", () => {
  it("keeps a small picture at its own size, centred when nothing says where", () => {
    expect(pictureBox({ width: 400, height: 200 }, slideSize, null)).toMatchObject({ x: 760, y: 440, w: 400, h: 200 })
  })

  it("scales a large picture down to fit inside the slide, keeping its shape", () => {
    const box = pictureBox({ width: 4000, height: 3000 }, slideSize, null)
    expect(box.h).toBeLessThanOrEqual(1080)
    expect(box.w / box.h).toBeCloseTo(4 / 3, 2)
    expect(box.x + box.w / 2).toBeCloseTo(960, 0)
    expect(box.y + box.h / 2).toBeCloseTo(540, 0)
  })

  it("centres on the drop point and keeps the picture inside the slide at an edge", () => {
    expect(pictureBox({ width: 400, height: 200 }, slideSize, { x: 600, y: 300 })).toMatchObject({ x: 400, y: 200 })
    expect(pictureBox({ width: 400, height: 200 }, slideSize, { x: 10, y: 1075 })).toMatchObject({ x: 0, y: 880 })
    expect(pictureBox({ width: 400, height: 200 }, slideSize, { x: 1915, y: 5 })).toMatchObject({ x: 1520, y: 0 })
  })
})

describe("adding a picture", () => {
  it("add a shape on top of the slide whose only fill is the image", () => {
    const { view, slides } = grow([{ type: "shape", name: "under", props: {} }])
    const box = pictureBox({ width: 400, height: 200 }, slideSize, null)
    const made = intentWrites(
      view,
      [{ op: "insert", kind: "picture", parent: slides[0]!, fill: { image: asset }, box }],
      { mint: () => doom.nodeId("m:1") },
    )
    const after = landed(view, made!.writes)
    const order = after.children.get(slides[0]!) ?? []
    expect(order.at(-1)).toBe("m:1")
    expect(after.nodes.get(doom.nodeId("m:1"))).toMatchObject({
      type: "shape",
      geometry: { kind: "rect" },
      fills: [{ kind: "image", asset, fit: "fill" }],
      box: { x: 760, y: 440, w: 400, h: 200, rotation: 0 },
    })
  })
})

import type { PaintElement } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { fillPlan } from "./fill-plan"

const blue = { hex: "1F4E79", alpha: 1 }
const box = { x: 0, y: 0, width: 100, height: 50, rotation: 0, flipH: false, flipV: false }
const photo = {
  part: "ppt/media/image1.png",
  contentType: "image/png",
  crop: { left: 0.1, top: 0, right: 0.1, bottom: 0 },
  tile: false,
}
const gradient = {
  type: "gradient",
  stops: [
    { position: 0, color: { hex: "000000", alpha: 0 } },
    { position: 1, color: { hex: "000000", alpha: 1 } },
  ],
  angle: 90,
  path: null,
} as const

function row(overrides: Partial<PaintElement>): PaintElement {
  return {
    part: "ppt/slides/slide1.xml",
    shape: "4",
    from: "slide",
    kind: "p:sp",
    box,
    group: null,
    placeholder: null,
    text: null,
    fill: null,
    line: null,
    geometry: null,
    image: null,
    ...overrides,
  }
}

it("plans a stack bottom first, with the layer's image placed by its crop in fractions of the box", () => {
  const plan = fillPlan(row({ kind: "p:pic", image: photo, stack: [{ type: "image" }, gradient] }))
  expect(plan.map((layer) => layer.kind)).toEqual(["image", "gradient"])
  expect(plan[0]).toMatchObject({ placed: { tile: false, x: -0.125, y: 0, width: 1.25, height: 1 } })
})

it("plans a photo with a solid behind it, and one colour, as the file holds them", () => {
  expect(
    fillPlan(row({ kind: "p:pic", image: photo, fill: { type: "solid", color: blue } })).map((each) => each.kind),
  ).toEqual(["color", "image"])
  expect(fillPlan(row({ fill: { type: "solid", color: blue } }))).toEqual([{ kind: "color", color: blue }])
  expect(fillPlan(row({ fill: { type: "none" } }))).toEqual([])
})

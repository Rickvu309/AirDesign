import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { cropChange, croppedBox } from "./crop-change"

const box = { x: 1_000_000, y: 500_000, cx: 4_000_000, cy: 2_000_000 }

it("moves the frame's edges with the crop, so the shown part keeps its scale", () => {
  expect(croppedBox(box, undefined, { l: 10_000, t: 0, r: 10_000, b: 0 })).toEqual({
    x: 1_400_000,
    y: 500_000,
    cx: 3_200_000,
    cy: 2_000_000,
  })
  const cropped = { x: 1_400_000, y: 500_000, cx: 3_200_000, cy: 2_000_000 }
  expect(croppedBox(cropped, { l: 10_000, t: 0, r: 10_000, b: 0 }, { l: 0, t: 0, r: 0, b: 0 })).toEqual(box)
  expect(croppedBox(box, undefined, { l: 60_000, t: 0, r: 40_000, b: 0 })).toBeNull()
})

it("sends the crop and the frame in one change, and the crop alone for an element with no box", () => {
  const view: ScopedElement = {
    node: elementId("256.4"),
    facts: { kind: "picture", text: false, grouped: false, animated: false },
    kept: [],
    value: null,
    box,
  }
  const rect = { l: 0, t: 25_000, r: 0, b: 25_000 }
  expect(cropChange(view, { l: 0, t: 0, r: 0, b: 0 })(rect)).toEqual({
    target: { node: "256.4" },
    crop: { rect },
    image: { mode: "crop" },
    box: { x: 1_000_000, y: 1_000_000, w: 4_000_000, h: 1_000_000 },
  })
  expect(cropChange({ ...view, box: null }, undefined)(rect)).toEqual({
    target: { node: "256.4" },
    crop: { rect },
    image: { mode: "crop" },
  })
})

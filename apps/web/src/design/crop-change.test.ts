import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { canvasCropChange, cropChange, croppedBox, cropTurn } from "./crop-change"

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
    facts: { kind: "shape", text: false, grouped: false, animated: false },
    kept: [],
    value: null,
    box,
  }
  const rect = { l: 0, t: 25_000, r: 0, b: 25_000 }
  expect(cropChange(view, { l: 0, t: 0, r: 0, b: 0 })(rect)).toEqual({
    target: { node: "256.4" },
    fills: { crop: rect, mode: "crop" },
    box: { x: 1_000_000, y: 1_000_000, w: 4_000_000, h: 1_000_000 },
  })
  expect(cropChange({ ...view, box: null }, undefined)(rect)).toEqual({
    target: { node: "256.4" },
    fills: { crop: rect, mode: "crop" },
  })
})

it("lands a crop dragged on the canvas as its crop, Crop mode and frame in one change", () => {
  const crop = { l: 0, t: 16_667, r: 25_000, b: 16_667 }
  const frame = { x: 1_000_000, y: 500_000, width: 1_500_000, height: 1_000_000 }
  expect(canvasCropChange(elementId("256.4"), { frame, crop })).toEqual({
    target: { node: "256.4" },
    fills: { crop, mode: "crop" },
    box: { x: 1_000_000, y: 500_000, w: 1_500_000, h: 1_000_000 },
  })
})

it("keeps the image in place when the crop fields cut a turned or flipped layer", () => {
  const rect = { l: 10_000, t: 0, r: 0, b: 0 }
  expect(croppedBox(box, undefined, rect, { rotation: 90, flipH: false, flipV: false })).toEqual({
    x: 1_200_000,
    y: 700_000,
    cx: 3_600_000,
    cy: 2_000_000,
  })
  expect(croppedBox(box, undefined, rect, { rotation: 0, flipH: true, flipV: false })).toEqual({
    x: 1_000_000,
    y: 500_000,
    cx: 3_600_000,
    cy: 2_000_000,
  })
  expect(cropTurn({ "box.rot": { value: 5_400_000 }, "box.flipH": { value: true } })).toEqual({
    rotation: 90,
    flipH: true,
    flipV: false,
  })
})

import { elementId, type ScopedElement } from "@airdesign/document"
import { expect, it } from "vitest"
import { cropChange, croppedBox, draggedCrop } from "./crop-change"

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

it("drags a crop edge in image coordinates and opens it back to the source edge", () => {
  const start = { l: 10_000, t: 0, r: 20_000, b: 0 }
  expect(draggedCrop(start, ["l"], { x: 35, y: 50 }, { width: 350, height: 200 })).toEqual({
    l: 17_000,
    t: 0,
    r: 20_000,
    b: 0,
  })
  expect(draggedCrop(start, ["l", "b"], { x: -60, y: 150 }, { width: 350, height: 200 })).toEqual({
    l: 0,
    t: 0,
    r: 20_000,
    b: 0,
  })
  expect(draggedCrop(start, ["r"], { x: -1000, y: 0 }, { width: 350, height: 200 }).r).toBe(89_000)
})

it("anchors the original image when cropping a rotated or reflected layer", () => {
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
})

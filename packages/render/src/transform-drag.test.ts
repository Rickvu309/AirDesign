import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import type { Point } from "./box-gesture.js"
import { evaluateTransform } from "./transform-drag.js"
import type { TransformGrip } from "./transform-math.js"

const wide = { width: 12_192_000, height: 6_858_000 }
const start = { x: 457_200, y: 457_200, cx: 5_486_400, cy: 1_828_800 }
const id = elementId("256.2")
const plain = { shiftKey: false, altKey: false, ctrlKey: false }

function dragged(grip: TransformGrip, at: Point, width: number, rotation = 0) {
  const result = evaluateTransform({
    grip,
    ids: [id],
    starts: new Map([[id, { box: start, rotation }]]),
    from: { x: 100, y: 100 },
    at,
    width,
    slide: wide,
    modifiers: plain,
    centerScreen: { x: 0, y: 0 },
  })
  return result.boxes.get(id)
}

describe("evaluateTransform", () => {
  it("moves by the pointer's travel at the canvas zoom", () => {
    expect(dragged("move", { x: 130, y: 160 }, 800)).toEqual({ ...start, x: 914_400, y: 1_371_600 })
  })

  it("resizes from the pressed corner by the pointer's travel at the canvas zoom", () => {
    expect(dragged("bottom-right", { x: -20, y: 160 }, 800)).toEqual({ ...start, cx: 3_657_600, cy: 2_743_200 })
  })

  it("lands on the same box at half the zoom with half the travel", () => {
    expect(dragged("move", { x: 115, y: 130 }, 400)).toEqual({ ...start, x: 914_400, y: 1_371_600 })
  })

  it("resizes a turned box from a drag by the pointer's travel on screen", () => {
    expect(dragged("bottom-right", { x: 95, y: 110 }, 800, 90)).toEqual({
      x: 342_900,
      y: 495_300,
      cx: 5_638_800,
      cy: 1_905_000,
    })
  })
})

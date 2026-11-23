import { describe, expect, it } from "vitest"
import { placedFrame } from "./crop-drag.js"

describe("the crop a person drags on the canvas", () => {
  it("places the new frame on the slide about the turned and flipped frame", () => {
    const box = { x: 1000, y: 500, width: 200, height: 100, rotation: 0, flipH: false, flipV: false }
    const frame = { x: 0, y: 0, width: 150, height: 100 }
    expect(placedFrame(box, frame)).toEqual({ x: 1000, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, flipH: true }, frame)).toEqual({ x: 1050, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, rotation: 180 }, frame)).toEqual({ x: 1050, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, rotation: 90 }, frame)).toEqual({ x: 1025, y: 475, width: 150, height: 100 })
  })
})

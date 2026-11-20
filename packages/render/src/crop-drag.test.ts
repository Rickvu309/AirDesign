import { describe, expect, it } from "vitest"
import { cropOf, cropStart, draggedCrop, localStep, placedFrame } from "./crop-drag.js"

const k = 10_000
const wide = { x: 0, y: -0.25, width: 1, height: 1.5 }
const area = (x: number, y: number, width: number, height: number) => ({
  x: x * k,
  y: y * k,
  width: width * k,
  height: height * k,
})

describe("the crop a person drags on the canvas", () => {
  it("starts from the image a Fill picture shows, overflowing the frame", () => {
    expect(cropStart(200 * k, 100 * k, wide)).toEqual({ frame: area(0, 0, 200, 100), image: area(0, -25, 200, 150) })
  })

  it("starts a Fit picture from the centred cover of the same image", () => {
    expect(cropStart(200 * k, 100 * k, { x: 0.25, y: 0, width: 0.5, height: 1 })).toEqual({
      frame: area(0, 0, 200, 100),
      image: area(0, -50, 200, 200),
    })
  })

  it("moves one edge inside the image and stops at the image's edge", () => {
    const start = cropStart(200 * k, 100 * k, wide)
    expect(draggedCrop(start, "e", -50 * k, 0).frame).toEqual(area(0, 0, 150, 100))
    expect(draggedCrop(start, "e", 80 * k, 0).frame).toEqual(area(0, 0, 200, 100))
    expect(draggedCrop(start, "n", 0, -40 * k).frame).toEqual(area(0, -25, 200, 125))
    expect(draggedCrop(start, "sw", 30 * k, 10 * k).frame).toEqual(area(30, 0, 170, 110))
  })

  it("keeps a frame of at least the smallest side", () => {
    const start = cropStart(200 * k, 100 * k, wide)
    const shrunk = draggedCrop(start, "w", 400 * k, 0).frame
    expect(shrunk).toEqual({ x: 200 * k - 228_600, y: 0, width: 228_600, height: 100 * k })
  })

  it("moves the image under the frame and keeps it covering the frame", () => {
    const start = cropStart(200 * k, 100 * k, wide)
    expect(draggedCrop(start, "move", 30 * k, 10 * k).image).toEqual(area(0, -15, 200, 150))
    expect(draggedCrop(start, "move", 0, -80 * k).image).toEqual(area(0, -50, 200, 150))
  })

  it("reads the crop as thousandths of a percent of the image on each side", () => {
    const start = cropStart(200 * k, 100 * k, wide)
    expect(cropOf(start)).toEqual({ l: 0, t: 16_667, r: 0, b: 16_667 })
    expect(cropOf(draggedCrop(start, "e", -50 * k, 0))).toEqual({ l: 0, t: 16_667, r: 25_000, b: 16_667 })
  })

  it("places the new frame on the slide about the turned and flipped frame", () => {
    const box = { x: 1000, y: 500, width: 200, height: 100, rotation: 0, flipH: false, flipV: false }
    const frame = { x: 0, y: 0, width: 150, height: 100 }
    expect(placedFrame(box, frame)).toEqual({ x: 1000, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, flipH: true }, frame)).toEqual({ x: 1050, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, rotation: 180 }, frame)).toEqual({ x: 1050, y: 500, width: 150, height: 100 })
    expect(placedFrame({ ...box, rotation: 90 }, frame)).toEqual({ x: 1025, y: 475, width: 150, height: 100 })
  })

  it("turns a pointer step on the screen into the frame's own axes", () => {
    const flat = { rotation: 0, flipH: false, flipV: false }
    expect(localStep(flat, 10, 5)).toEqual({ x: 10, y: 5 })
    expect(localStep({ ...flat, flipH: true }, 10, 5)).toEqual({ x: -10, y: 5 })
    const turned = localStep({ ...flat, rotation: 90 }, 10, 5)
    expect(turned.x).toBeCloseTo(5)
    expect(turned.y).toBeCloseTo(-10)
  })
})

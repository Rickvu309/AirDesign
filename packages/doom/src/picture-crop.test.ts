import { describe, expect, it } from "vitest"
import { coverCrop, cropSides, cropWindow } from "./picture-crop.js"

describe("a crop as PowerPoint's srcRect holds it, the sides cut in percent", () => {
  it("turns the sides cut into the part of the picture that shows, and back", () => {
    expect(cropWindow({ left: 10, top: 0, right: 30, bottom: 25 })).toEqual({ x: 0.1, y: 0, w: 0.6, h: 0.75 })
    expect(cropSides({ x: 0.1, y: 0, w: 0.6, h: 0.75 })).toEqual({ left: 10, top: 0, right: 30, bottom: 25 })
  })

  it("keeps a side cut of a third whole after the round trip", () => {
    const window = cropWindow({ left: 100 / 3, top: 0, right: 0, bottom: 0 })
    expect(cropSides(window).left).toBeCloseTo(33.33, 2)
  })

  it("shows the whole picture when nothing is cut", () => {
    expect(cropWindow({ left: 0, top: 0, right: 0, bottom: 0 })).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })

  it("never leaves a window with no area", () => {
    const window = cropWindow({ left: 60, top: 0, right: 60, bottom: 0 })
    expect(window.w).toBeGreaterThan(0)
    expect(window.x + window.w).toBeLessThanOrEqual(1)
  })
})

describe("the part of a picture that Fill shows in a frame", () => {
  it("cuts the sides of a picture wider than its frame, centred", () => {
    expect(coverCrop({ w: 100, h: 100 }, { width: 400, height: 200 })).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
  })

  it("cuts the top and bottom of a picture taller than its frame, centred", () => {
    expect(coverCrop({ w: 200, h: 100 }, { width: 100, height: 100 })).toEqual({ x: 0, y: 0.25, w: 1, h: 0.5 })
  })

  it("shows the whole picture in a frame of its own shape", () => {
    expect(coverCrop({ w: 300, h: 150 }, { width: 600, height: 300 })).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

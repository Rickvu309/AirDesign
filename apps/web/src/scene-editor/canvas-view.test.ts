import { describe, expect, it } from "vitest"
import { fitScale, scaleOf, steppedScale, wheelScale } from "./canvas-view"

const slide = { w: 1920, h: 1080 }

describe("canvas view", () => {
  it("fits the whole slide inside the room, in whole pixels of width as the old editor does", () => {
    const scale = fitScale({ w: 1344, h: 840 }, slide)
    expect(scale).toBeCloseTo(1344 / 1920)
    expect(slide.h * scale).toBeLessThanOrEqual(840)
    expect(Math.round(slide.w * scale)).toBe(1344)
  })

  it("fits by height when the room is wide", () => {
    expect(fitScale({ w: 3000, h: 700 }, slide)).toBeCloseTo(Math.floor((700 * 1920) / 1080) / 1920)
  })

  it("never zooms past the same limits as the old editor", () => {
    expect(scaleOf(50, { w: 800, h: 600 }, slide)).toBe(4)
    expect(scaleOf(0.001, { w: 800, h: 600 }, slide)).toBe(0.1)
  })

  it("steps to the next stop in either direction", () => {
    expect(steppedScale(0.6, 1)).toBe(0.75)
    expect(steppedScale(0.6, -1)).toBe(0.5)
    expect(steppedScale(1, 1)).toBe(1.5)
    expect(steppedScale(4, 1)).toBe(4)
    expect(steppedScale(0.1, -1)).toBe(0.1)
  })

  it("zooms in on a negative wheel delta and out on a positive one", () => {
    expect(wheelScale(1, -50)).toBeGreaterThan(1)
    expect(wheelScale(1, 50)).toBeLessThan(1)
  })
})

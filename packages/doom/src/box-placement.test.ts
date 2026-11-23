import { describe, expect, it } from "vitest"
import { largestFreeBox } from "./box-placement.js"

const slide = { width: 1920, height: 1080 }
const margin = { x: Math.round(1920 * 0.04), y: Math.round(1080 * 0.04) }
const whole = { x: margin.x, y: margin.y, cx: 1920 - 2 * margin.x, cy: 1080 - 2 * margin.y }

describe("the largest free box on a slide", () => {
  it("is the slide inside its margins when nothing is on it", () => {
    expect(largestFreeBox(slide, [])).toEqual(whole)
  })

  it("is the free column beside a left half that holds text", () => {
    const left = { x: 0, y: 0, cx: 960, cy: 1080 }
    expect(largestFreeBox(slide, [left])).toEqual({ x: 960, y: margin.y, cx: 1920 - margin.x - 960, cy: whole.cy })
  })

  it("ignores a box with no area, and counts a line as taken", () => {
    expect(largestFreeBox(slide, [{ x: 500, y: 500, cx: 0, cy: 0 }])).toEqual(whole)
    const line = { x: margin.x, y: 540, cx: whole.cx, cy: 0 }
    const below = largestFreeBox(slide, [line])
    expect(below?.cy).toBeLessThan(whole.cy / 2 + 1)
  })

  it("is nothing when the slide is full", () => {
    expect(largestFreeBox(slide, [{ x: 0, y: 0, cx: 1920, cy: 1080 }])).toBeUndefined()
  })
})

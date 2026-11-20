import { describe, expect, it } from "vitest"
import { rulerStep, rulerTicks } from "./ruler-scale.js"

describe("rulerStep", () => {
  it("picks the smallest round step in points whose labels sit 48 pixels apart", () => {
    expect(rulerStep(1)).toBe(50)
    expect(rulerStep(0.5)).toBe(100)
    expect(rulerStep(2)).toBe(50)
    expect(rulerStep(2.5)).toBe(20)
    expect(rulerStep(10)).toBe(5)
    expect(rulerStep(64)).toBe(1)
    expect(rulerStep(0.01)).toBe(5000)
  })
})

describe("rulerTicks", () => {
  it("labels every step from the slide's top-left corner and marks fifths between", () => {
    const ticks = rulerTicks({ length: 220, origin: 20, pixelsPerPoint: 1 })
    expect(ticks.filter((tick) => tick.label !== null)).toEqual([
      { at: 20, label: "0" },
      { at: 70, label: "50" },
      { at: 120, label: "100" },
      { at: 170, label: "150" },
      { at: 220, label: "200" },
    ])
    expect(ticks.filter((tick) => tick.label === null).map((tick) => tick.at)).toEqual([
      0, 10, 30, 40, 50, 60, 80, 90, 100, 110, 130, 140, 150, 160, 180, 190, 200, 210,
    ])
  })

  it("counts negative points left of the slide", () => {
    const labels = rulerTicks({ length: 100, origin: 100, pixelsPerPoint: 1 }).flatMap((tick) =>
      tick.label === null ? [] : [tick.label],
    )
    expect(labels).toEqual(["-100", "-50", "0"])
  })

  it("marks fifths of a 100 point step at half scale", () => {
    const ticks = rulerTicks({ length: 200, origin: 0, pixelsPerPoint: 0.5 })
    expect(ticks.filter((tick) => tick.label === null).map((tick) => tick.at)).toEqual([
      10, 20, 30, 40, 60, 70, 80, 90, 110, 120, 130, 140, 160, 170, 180, 190,
    ])
  })
})

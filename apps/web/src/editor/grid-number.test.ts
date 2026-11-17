import { describe, expect, it } from "vitest"
import { gridNumberPlacement, gridElementPresses } from "./grid-number"

describe("grid number placement", () => {
  it.each([
    [53, "above"],
    [15, "inside"],
    [9, "inside"],
    [5, "inside"],
    [4, "hidden"],
  ])("matches the Figma reference at %s percent", (percent, placement) => {
    expect(gridNumberPlacement({ width: (1920 * percent) / 100, gap: (1080 * 0.57 * percent) / 100 })).toBe(placement)
  })
  it("uses screen dimensions for a 4:3 slide too", () => {
    expect(gridNumberPlacement({ width: 96, gap: 41 })).toBe("inside")
    expect(gridNumberPlacement({ width: 76.8, gap: 33 })).toBe("hidden")
    expect(gridNumberPlacement({ width: 400, gap: 171 })).toBe("above")
  })
  it("has deterministic boundaries when the settled zoom crosses a threshold", () => {
    expect(gridNumberPlacement({ width: 87.99, gap: 50 })).toBe("hidden")
    expect(gridNumberPlacement({ width: 88, gap: 50 })).toBe("inside")
    expect(gridNumberPlacement({ width: 400, gap: 111.99 })).toBe("inside")
    expect(gridNumberPlacement({ width: 400, gap: 112 })).toBe("above")
  })
})

it("keeps element presses at main’s 28 px gap threshold and excludes hidden numbers", () => {
  expect(gridElementPresses({ width: 100, gap: 27.99 })).toBe(false)
  expect(gridElementPresses({ width: 100, gap: 28 })).toBe(true)
  expect(gridElementPresses({ width: 87.99, gap: 112 })).toBe(false)
  expect(gridElementPresses({ width: 88, gap: 28 })).toBe(true)
})

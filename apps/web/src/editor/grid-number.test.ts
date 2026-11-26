import { describe, expect, it } from "vitest"
import { gridNumberPlacement } from "./grid-number"

describe("grid number placement", () => {
  it.each([
    [289, "above"],
    [257, "inside"],
    [89, "inside"],
    [71, "hidden"],
  ])("matches the Figma reference for a slide %s screen pixels wide", (width, placement) => {
    expect(gridNumberPlacement({ width, gap: ((width * 9) / 16) * 0.57 })).toBe(placement)
  })
  it("uses screen dimensions for a 4:3 slide too", () => {
    expect(gridNumberPlacement({ width: 96, gap: 41 })).toBe("inside")
    expect(gridNumberPlacement({ width: 76.8, gap: 33 })).toBe("hidden")
    expect(gridNumberPlacement({ width: 400, gap: 171 })).toBe("above")
  })
  it("has deterministic boundaries when the settled zoom crosses a threshold", () => {
    expect(gridNumberPlacement({ width: 87.99, gap: 50 })).toBe("hidden")
    expect(gridNumberPlacement({ width: 88, gap: 50 })).toBe("inside")
    expect(gridNumberPlacement({ width: 400, gap: 87.99 })).toBe("inside")
    expect(gridNumberPlacement({ width: 400, gap: 88 })).toBe("above")
  })
})

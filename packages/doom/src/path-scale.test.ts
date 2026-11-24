import { describe, expect, it } from "vitest"
import { scalePath } from "./path-scale.js"

describe("scalePath", () => {
  it("reports scaled bounds for an absolute polyline, including overflow", () => {
    expect(scalePath("M0 0L1 1L-0.25 0.2 1.1 0.9", 100, 200)).toEqual({
      d: "M0 0L100 200L-25 40 110 180",
      bounds: { x: -25, y: 0, width: 135, height: 200 },
    })
  })

  it("scales absolute points by the box's width and height", () => {
    expect(scalePath("M0 0L1 0.5L0.5 1Z", 200, 100).d).toBe("M0 0L200 50L100 100Z")
  })

  it("scales relative moves the same way, horizontal and vertical lines by one axis", () => {
    expect(scalePath("M0.1 0.1h0.2v0.3l0.1 0.1z", 100, 200).d).toBe("M10 20h20v60l10 20z")
  })

  it("scales curves by every point and an arc by its radii and end point, leaving angle and flags alone", () => {
    expect(scalePath("M0 0C0.1 0.2 0.3 0.4 0.5 0.6", 10, 10).d).toBe("M0 0C1 2 3 4 5 6")
    expect(scalePath("M0 0A0.5 0.25 30 0 1 1 1", 100, 40)).toEqual({ d: "M0 0A50 10 30 0 1 100 40" })
  })

  it("keeps commas, signs and exponents readable and reads repeated pairs after one command", () => {
    expect(scalePath("M0,0 L1,1 0.5,-0.5", 10, 10).d).toBe("M0 0L10 10 5 -5")
    expect(scalePath("M0 0L1e-1 5e-1", 10, 10).d).toBe("M0 0L1 5")
  })
})

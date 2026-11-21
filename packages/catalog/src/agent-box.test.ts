import { describe, expect, it } from "vitest"
import { pointBox, pointSize } from "./agent-box.js"

describe("a box an agent reads is in the points it writes", () => {
  it("turns EMU into points with w and h, to a tenth", () => {
    expect(pointBox({ x: 914_400, y: 1_828_800, cx: 10_363_200, cy: 1_371_600 })).toEqual({
      x: 72,
      y: 144,
      w: 816,
      h: 108,
    })
    expect(pointBox({ x: 3_948_437, y: 0, cx: 1, cy: 0 })).toEqual({ x: 310.9, y: 0, w: 0, h: 0 })
  })

  it("gives a 16:9 slide as 960 by 540", () => {
    expect(pointSize({ width: 12_192_000, height: 6_858_000 })).toEqual({ w: 960, h: 540 })
  })
})

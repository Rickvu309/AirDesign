import { describe, expect, it } from "vitest"
import { cropCursor, cropGripReach } from "./crop-handles"

describe("crop handles", () => {
  it("turns each grip's cursor with the picture, as a resize cursor does", () => {
    expect(cropCursor("crop-n", 0)).toBe("ns-resize")
    expect(cropCursor("crop-e", 0)).toBe("ew-resize")
    expect(cropCursor("crop-se", 0)).toBe("nwse-resize")
    expect(cropCursor("crop-n", 90)).toBe("ew-resize")
    expect(cropCursor("crop-se", 30)).toBe("ns-resize")
    expect(cropCursor("crop-ne", 30)).toBe("ew-resize")
  })

  it("shrinks or drops the corner and edge hits so the centre of a small frame stays free", () => {
    expect(cropGripReach(200, 100)).toBe(12)
    const tight = cropGripReach(16, 16)
    expect(tight).toBeGreaterThan(0)
    expect(tight).toBeLessThan(8)
    expect(Math.hypot(8, 8)).toBeGreaterThan(tight)
    expect(cropGripReach(8, 8)).toBe(0)
    expect(cropGripReach(16, 200)).toBe(tight)
  })
})

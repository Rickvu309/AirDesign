import { describe, expect, it } from "vitest"
import { slideId } from "./element-id.js"
import { defaultGrid1 } from "./grid-order.js"

const file = Array.from({ length: 10 }, (_, i) => slideId(String(256 + i)))

describe("stored grid slide groups", () => {
  it("freezes the version-one default fixture", () => {
    const columns = [
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8,
      8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9,
    ]
    for (const [count, width] of columns.entries()) {
      const ids = Array.from({ length: count }, (_, index) => slideId(String(index + 1)))
      expect(defaultGrid1(ids)).toEqual({ starts: ids.filter((_, index) => index % width === 0) })
    }

    expect(defaultGrid1(file)).toEqual({ starts: ["256", "260", "264"] })
    expect(defaultGrid1(Array.from({ length: 50 }, (_, i) => slideId(String(i + 1))))).toEqual({
      starts: ["1", "10", "19", "28", "37", "46"],
    })
  })
})

import { describe, expect, it } from "vitest"
import { scrubbed } from "@/design/controls/number"

const plain = { shiftKey: false, altKey: false }
const shift = { shiftKey: true, altKey: false }
const alt = { shiftKey: false, altKey: true }

describe("scrubbing a number field", () => {
  it("moves one step for every two pixels and keeps the pixels left over", () => {
    expect(scrubbed({ value: 432, x: 100 }, 110, plain, 1)).toEqual({ value: 437, x: 110 })
    expect(scrubbed({ value: 432, x: 100 }, 103, plain, 1)).toEqual({ value: 433, x: 102 })
    expect(scrubbed({ value: 432, x: 100 }, 101, plain, 1)).toEqual({ value: 432, x: 100 })
    expect(scrubbed({ value: 432, x: 100 }, 95, plain, 1)).toEqual({ value: 430, x: 96 })
  })

  it("moves tens with Shift and tenths with Alt", () => {
    expect(scrubbed({ value: 432, x: 100 }, 104, shift, 1)).toEqual({ value: 452, x: 104 })
    expect(scrubbed({ value: 12, x: 100 }, 106, alt, 1)).toEqual({ value: 12.3, x: 106 })
    expect(scrubbed({ value: 0.3, x: 100 }, 96, alt, 1)).toEqual({ value: 0.1, x: 96 })
  })

  it("steps by the field's own step", () => {
    expect(scrubbed({ value: 50, x: 0 }, 4, plain, 5)).toEqual({ value: 60, x: 4 })
  })
})

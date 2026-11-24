import { describe, expect, it } from "vitest"
import { scrubAfter, scrubbed, storedFromTyped } from "@/design/controls/number"
import type { PanelControl } from "@/design/panel"

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

describe("scrubbing past a limit", () => {
  it("anchors at the limit, so dragging back moves the value at once", () => {
    const past = scrubbed({ value: 100, x: 0 }, 400, plain, 1)
    expect(past.value).toBe(300)
    const held = scrubAfter(past, 100)
    expect(held).toEqual({ value: 100, x: 400 })
    expect(scrubbed(held, 300, plain, 1).value).toBe(50)
    expect(scrubAfter(past, 300)).toBe(past)
  })
})

describe("a typed number past its range", () => {
  const ranged = (unit: string, min: number, max: number) =>
    ({ desc: { kind: "number", unit, min, max }, value: 0, mixed: false }) as unknown as PanelControl

  it("is clamped to the limit and stored, never dropped", () => {
    const size = ranged("hundredth-point", 100, 200_000)
    expect(storedFromTyped(size, 2001)).toBe(200_000)
    expect(storedFromTyped(size, 0)).toBe(100)
    const line = ranged("fraction", 50_000, 500_000)
    expect(storedFromTyped(line, 501)).toBe(500_000)
    expect(storedFromTyped(line, 1)).toBe(50_000)
    expect(storedFromTyped(line, Number.NaN)).toBeNull()
  })
})

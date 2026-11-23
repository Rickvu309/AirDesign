import { describe, expect, it } from "vitest"
import { roundedShown, steppedFrom, untouched } from "./shown-number"

const read = (text: string) => (Number.isFinite(Number(text)) ? Number(text) : null)

describe("a rounded number field", () => {
  it("shows 33 for a colour's 33.333% opacity and counts Enter on it as untouched, so nothing is written", () => {
    const shown = roundedShown(33_333 / 1_000, 0)
    expect(shown.text).toBe("33")
    expect(untouched("33", shown)).toBe(true)
    expect(untouched("34", shown)).toBe(false)
  })

  it("steps a chart cell from its stored 1.234, not from the 1.23 it shows", () => {
    const shown = roundedShown(1.234, 2)
    expect(shown.text).toBe("1.23")
    expect(steppedFrom("1.23", shown, read) + 1).toBeCloseTo(2.234, 6)
    expect(steppedFrom("5", shown, read)).toBe(5)
  })

  it("shows nothing for an unknown value", () => {
    expect(roundedShown(undefined, 2)).toEqual({ text: "", exact: null })
  })
})

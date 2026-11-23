import { describe, expect, it } from "vitest"
import { readValue } from "./value-kind.js"
import { traits } from "./traits.js"

describe("the deck's template styles", () => {
  it("reads a template color as six hex digits and a font as its name", () => {
    expect(readValue(traits.templateStyle.fields.accent1, "C00000")).toBe("C00000")
    expect(readValue(traits.templateStyle.fields.accent1, "c00000")).toBeNull()
    expect(readValue(traits.templateStyle.fields.accent1, "accent2")).toBeNull()
    expect(readValue(traits.templateStyle.fields.major, "Georgia")).toBe("Georgia")
  })
})

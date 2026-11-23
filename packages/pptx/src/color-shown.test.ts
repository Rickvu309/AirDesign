import { describe, expect, it } from "vitest"
import { colorHex } from "./color-shown.js"

const theme = [
  { scheme: "dk1", css: "000000" },
  { scheme: "lt1", css: "FFFFFF" },
  { scheme: "dk2", css: "44546A" },
  { scheme: "lt2", css: "E7E6E6" },
  { scheme: "accent1", css: "4472C4" },
] as const

describe("the colour a stored colour shows", () => {
  it("paints a theme slot, a theme tint and an rgb colour as the canvas does", () => {
    expect(colorHex({ scheme: "accent1" }, theme)).toBe("4472C4")
    expect(
      colorHex(
        {
          scheme: "accent1",
          transforms: [
            { op: "lumMod", val: 60_000 },
            { op: "lumOff", val: 40_000 },
          ],
        },
        theme,
      ),
    ).toBe("8FAADC")
    expect(colorHex({ scheme: "accent1", transforms: [{ op: "lumMod", val: 75_000 }] }, theme)).toBe("2F5597")
    expect(colorHex({ rgb: "1F4E79" }, theme)).toBe("1F4E79")
  })

  it("reads a mapped slot as its usual theme slot", () => {
    expect(colorHex({ scheme: "tx1" }, theme)).toBe("000000")
    expect(colorHex({ scheme: "bg2" }, theme)).toBe("E7E6E6")
  })

  it("shows a system and a preset colour as PowerPoint resolves them, and nothing for a missing slot", () => {
    expect(colorHex({ system: "windowText", last: "101010" }, theme)).toBe("101010")
    expect(colorHex({ preset: "red" }, theme)).toBe("FF0000")
    expect(colorHex({ scheme: "accent6" }, theme)).toBeNull()
  })
})

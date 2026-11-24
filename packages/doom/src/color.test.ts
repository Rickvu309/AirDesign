import { describe, expect, it } from "vitest"
import { readColor, resolveColor, sameColor, tinted } from "./color.js"
import { defaultTheme } from "./theme.js"
import type { Hex } from "./paint.js"

const hex = (digits: string): Hex => `#${digits}`

describe("a colour a caller hands in", () => {
  it("reads a hex in lower case and a theme colour with or without a tint", () => {
    expect(readColor(hex("1F4E79"))).toBe(hex("1f4e79"))
    expect(readColor({ var: "accent1" })).toEqual({ var: "accent1" })
    expect(readColor({ var: "text2", tint: -0.25 })).toEqual({ var: "text2", tint: -0.25 })
  })

  it("refuses what is not a slide colour, without throwing", () => {
    for (const raw of [
      undefined,
      null,
      "1F4E79",
      hex("1F4E7"),
      { var: "dk1" },
      { var: "accent1", tint: 2 },
      { rgb: "1F4E79" },
    ])
      expect(readColor(raw)).toBeUndefined()
  })
})

describe("two colours that paint the same way", () => {
  it("matches a hex in any case and a theme colour whose tint is missing or zero", () => {
    expect(sameColor(hex("1F4E79"), hex("1f4e79"))).toBe(true)
    expect(sameColor({ var: "accent1" }, { var: "accent1", tint: 0 })).toBe(true)
    expect(sameColor({ var: "accent1", tint: 0.4 }, { var: "accent1", tint: 0.4 })).toBe(true)
  })

  it("keeps apart another theme colour, another tint and a hex that happens to look the same", () => {
    expect(sameColor({ var: "accent1" }, { var: "accent2" })).toBe(false)
    expect(sameColor({ var: "accent1", tint: 0.4 }, { var: "accent1", tint: -0.4 })).toBe(false)
    expect(sameColor({ var: "accent1" }, resolveColor({ var: "accent1" }, defaultTheme))).toBe(false)
  })
})

describe("a tinted theme colour", () => {
  it("moves each channel towards white for a positive tint and towards black for a negative one", () => {
    expect(tinted(hex("4472c4"), 0.4)).toBe(hex("8faadc"))
    expect(tinted(hex("4472c4"), -0.25)).toBe(hex("335693"))
    expect(resolveColor({ var: "accent1", tint: 0 }, defaultTheme)).toBe(defaultTheme.colors.accent1)
  })
})

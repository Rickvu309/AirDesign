import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { swatchesOf } from "./design-palette"
import { neutralColorNames } from "./testing/neutral-color-names"

describe("swatchesOf", () => {
  it("names each theme colour with the colour word a person would say, never its hex", () => {
    const swatches = swatchesOf(doom.defaultTheme)
    for (const swatch of swatches) expect(swatch.name).toMatch(/^[A-Z][a-z]+( [a-z]+)*( \d)?$/)
    expect(new Set(swatches.map((swatch) => swatch.name)).size).toBe(swatches.length)
    expect(swatches.find((swatch) => swatch.css === doom.defaultTheme.colors.background.toUpperCase())?.name).toBe(
      "White",
    )
  })
})

describe("neutralColorNames", () => {
  it("are the names a new deck's panel shows", () => {
    const theme = doom.themeLibrary.neutral.theme
    const names = Object.fromEntries(swatchesOf(theme).map((swatch) => [swatch.var, swatch.name]))
    expect(names).toEqual(neutralColorNames)
  })
})

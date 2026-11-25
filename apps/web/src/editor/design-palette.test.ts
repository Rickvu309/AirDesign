import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { pickerSwatches } from "@/design/color-choices"
import { paletteOf } from "./design-palette"
import { neutralColorNames } from "./testing/neutral-color-names"

const swatchesOf = (theme: doom.Theme) => pickerSwatches(paletteOf(doom.emptyDoom, theme).templateColors)

describe("the design palette", () => {
  it("offers the eleven palette colors for every built-in theme", () => {
    for (const { theme } of Object.values(doom.themeLibrary)) {
      const vars = swatchesOf(theme).map(({ var: role }) => role)
      expect(vars).toHaveLength(11)
      for (const role of ["positive", "negative", "total"]) expect(vars).not.toContain(role)
    }
  })

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

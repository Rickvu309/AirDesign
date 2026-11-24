import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { swatchesOf } from "./design-palette"
import { neutralColorNames } from "./testing/neutral-color-names"
import { templateNameOf } from "./design-template-name"

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

describe("templateNameOf", () => {
  it("names the template a deck's theme came from", () => {
    for (const { name, theme } of Object.values(doom.themeLibrary)) expect(templateNameOf(theme)).toBe(name)
  })

  it("has no name for a theme that matches no template", () => {
    expect(templateNameOf(doom.defaultTheme)).toBeNull()
  })
})

describe("neutralColorNames", () => {
  it("are the names a new deck's panel shows", () => {
    const theme = doom.themeLibrary.neutral.theme
    for (const [name, shown] of Object.entries(neutralColorNames))
      expect(swatchesOf(theme).find((swatch) => swatch.var === name)?.name).toBe(shown)
  })
})

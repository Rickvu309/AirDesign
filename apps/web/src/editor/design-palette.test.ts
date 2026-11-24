import * as doom from "@airdesign/doom"
import { deckTemplates, templateTheme } from "@airdesign/templates"
import { describe, expect, it } from "vitest"
import { colorNameOf, swatchesOf } from "./design-palette"
import { neutralColorNames } from "@/testing/neutral-color-names"
import { templateNameOf } from "./design-template-name"

const newDeckTheme = (): doom.Theme => {
  const neutral = templateTheme("neutral")
  if (neutral === undefined) throw new Error("neutral template")
  const { colors, fonts } = neutral
  const hex = (value: string) => `#${value.toLowerCase()}` as doom.Hex
  return {
    colors: {
      text: hex(colors.dk1),
      background: hex(colors.lt1),
      text2: hex(colors.dk2),
      background2: hex(colors.lt2),
      accent1: hex(colors.accent1),
      accent2: hex(colors.accent2),
      accent3: hex(colors.accent3),
      accent4: hex(colors.accent4),
      accent5: hex(colors.accent5),
      accent6: hex(colors.accent6),
      link: hex(colors.hlink),
    },
    fonts: { heading: fonts.major, body: fonts.minor },
    textStyles: doom.slideTextStyles,
    effectStyles: doom.defaultTheme.effectStyles,
  }
}

const asTheme = (id: string): doom.Theme => {
  const { colors, fonts } = templateTheme(id)!
  const hex = (value: string) => `#${value.toLowerCase()}` as doom.Hex
  return {
    ...doom.defaultTheme,
    colors: { ...doom.defaultTheme.colors, accent1: hex(colors.accent1), accent2: hex(colors.accent2) },
    fonts: { heading: fonts.major, body: fonts.minor },
  }
}

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
    for (const { id, name } of deckTemplates) expect(templateNameOf(asTheme(id))).toBe(name)
  })

  it("has no name for a theme that matches no template", () => {
    expect(templateNameOf(doom.defaultTheme)).toBeNull()
  })
})

describe("neutralColorNames", () => {
  it("are the names a new deck's panel shows", () => {
    const theme = newDeckTheme()
    for (const [name, shown] of Object.entries(neutralColorNames))
      expect(colorNameOf(theme, name as doom.ColorVar)).toBe(shown)
  })
})

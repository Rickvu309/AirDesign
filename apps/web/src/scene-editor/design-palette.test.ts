import { scene } from "@airdesign/document"
import { deckTemplates, templateTheme } from "@airdesign/templates"
import { describe, expect, it } from "vitest"
import { startEdit } from "../../../api/src/scene-start"
import { colorNameOf, swatchesOf } from "./design-palette"
import { neutralColorNames } from "./neutral-color-names"
import { templateNameOf } from "./design-template-name"

const asTheme = (id: string): scene.Theme => {
  const { colors, fonts } = templateTheme(id)!
  const hex = (value: string) => `#${value.toLowerCase()}` as scene.Hex
  return {
    ...scene.defaultTheme,
    colors: { ...scene.defaultTheme.colors, accent1: hex(colors.accent1), accent2: hex(colors.accent2) },
    fonts: { heading: fonts.major, body: fonts.minor },
  }
}

describe("swatchesOf", () => {
  it("names each theme colour with the colour word a person would say, never its hex", () => {
    const swatches = swatchesOf(scene.defaultTheme)
    for (const swatch of swatches) expect(swatch.name).toMatch(/^[A-Z][a-z]+( [a-z]+)*( \d)?$/)
    expect(new Set(swatches.map((swatch) => swatch.name)).size).toBe(swatches.length)
    expect(swatches.find((swatch) => swatch.css === scene.defaultTheme.colors.background.toUpperCase())?.name).toBe(
      "White",
    )
  })
})

describe("templateNameOf", () => {
  it("names the template a deck's theme came from", () => {
    for (const { id, name } of deckTemplates) expect(templateNameOf(asTheme(id))).toBe(name)
  })

  it("has no name for a theme that matches no template", () => {
    expect(templateNameOf(scene.defaultTheme)).toBeNull()
  })
})

describe("neutralColorNames", () => {
  it("are the names a new deck's panel shows", () => {
    const theme = startEdit().writes.find((write) => write.prop === "theme")!.value as scene.Theme
    for (const [name, shown] of Object.entries(neutralColorNames))
      expect(colorNameOf(theme, name as scene.ColorVar)).toBe(shown)
  })
})

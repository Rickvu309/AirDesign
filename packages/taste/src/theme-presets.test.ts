import { createHash } from "node:crypto"
import { readdirSync } from "node:fs"
import { paletteColorVars, type ColorVar, type Hex } from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"
import midnight from "../files/styles/midnight.json" with { type: "json" }
import { listStyles, newDeckTheme, themePresetById, themePresetOf, themePresets } from "./index.js"
import { designedThemes, libraryArt } from "./theme-preset-art.js"

const backgrounds = ["background", "background2"] as const satisfies readonly ColorVar[]
const inks = paletteColorVars.filter((color) => color !== "background" && color !== "background2")

function linearChannel(color: Hex, offset: number): number {
  const srgb = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

const luminance = (color: Hex) =>
  0.2126 * linearChannel(color, 1) + 0.7152 * linearChannel(color, 3) + 0.0722 * linearChannel(color, 5)

describe("built-in themes", () => {
  it("ships one preset for every style", () => {
    const ids = themePresets.map(({ id }) => id).sort()
    const files = readdirSync("packages/taste/files/styles").filter((file) => file.endsWith(".json"))
    expect(files.sort()).toEqual(ids.map((id) => `${id}.json`))
    expect(ids).toEqual(listStyles().map(({ name }) => name))
  })

  it("keeps every preset value apart from the Consulting accent and Technical title size", () => {
    const actual = Object.fromEntries(
      themePresets.map(({ id, theme }) => [id, createHash("sha256").update(JSON.stringify(theme)).digest("hex")]),
    )
    expect(actual).toEqual({
      consulting: "efb3527b5e1f8e3a8b32c2aa47bef1aeed48ad76bddc06cf043bba6f1ffa78fc",
      editorial: "9b60e474ef40b369616d07fd2493a40482bd24788ea4755c596cb969a36489d3",
      midnight: "66af9b1a0e36c4ab16de6a2cee83dcd2780c00c95a45db92efe5c29623d8fae3",
      neutral: "b3429917b395d0fb5521e7be117b2640f33728ef73c590af9971acbaa8d214bb",
      technical: "5d735932823a91226cbd0d251f9e308d9c3381d3d69139d0e89960a56bff1efc",
    })
  })

  it.each(libraryArt)(
    "preserves $name art and inherits the slide type scale and effects",
    ({ id, name, accent1, heading }) => {
      expect(themePresetById(id)).toMatchObject({
        id,
        name,
        theme: {
          colors: { accent1 },
          fonts: { heading },
          textStyles: newDeckTheme.textStyles,
          effectStyles: newDeckTheme.effectStyles,
        },
      })
    },
  )

  it("recognizes a stored copy and distinguishes a customized theme", () => {
    const theme = newDeckTheme
    expect(themePresetOf({ ...theme, colors: { ...theme.colors } })?.id).toBe("neutral")
    expect(themePresetOf({ ...theme, fonts: { ...theme.fonts, body: "Lora" } })).toBeUndefined()
  })

  it.each(themePresets)("distinguishes gains and losses in $name", ({ id, theme }) => {
    const colors: Readonly<Record<string, Hex>> = theme.colors
    const contrast = (a: Hex, b: Hex) => {
      const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y)
      return (light! + 0.05) / (dark! + 0.05)
    }
    const { positive, negative, total } = colors
    if (positive === undefined || negative === undefined || total === undefined)
      throw new Error(`Missing signed colors in ${id}`)
    expect(contrast(positive, negative)).toBeGreaterThanOrEqual(2)
    for (const paint of [positive, negative, total])
      for (const surface of backgrounds) expect(contrast(paint, theme.colors[surface])).toBeGreaterThanOrEqual(3)
  })

  it("gives a Consulting accent enough contrast to stand apart from its text", () => {
    const { colors } = themePresetById("consulting")!.theme
    expect((luminance(colors.accent1) + 0.05) / (luminance(colors.text) + 0.05)).toBeGreaterThanOrEqual(2)
  })

  it.each(designedThemes)("preserves $name art and type scale", ({ id, name, ...theme }) => {
    expect(themePresetById(id)).toMatchObject({ id, name, theme })
  })

  it.each(designedThemes)("meets WCAG AA for $name text on both background tokens", ({ id }) => {
    const entry = themePresetById(id)
    if (entry === undefined) throw new Error(`Missing theme ${id}`)

    const { colors } = entry.theme
    for (const background of backgrounds) {
      const surface = luminance(colors[background])
      for (const ink of inks) {
        const foreground = luminance(colors[ink])
        const ratio = (Math.max(surface, foreground) + 0.05) / (Math.min(surface, foreground) + 0.05)
        expect(ratio, `${id} ${ink} / ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe("malformed built-in themes", () => {
  it("refuses a malformed color and names the preset and field", async () => {
    vi.resetModules()
    vi.doMock("../files/styles/midnight.json", () => ({
      default: { ...midnight, colors: { ...midnight.colors, accent1: "6b9bff" } },
    }))
    try {
      await expect(import("./theme-presets.js")).rejects.toThrow(/midnight\.json.*colors/)
    } finally {
      vi.doUnmock("../files/styles/midnight.json")
      vi.resetModules()
    }
  })
})

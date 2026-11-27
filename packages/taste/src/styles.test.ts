import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { paletteColorVars, type ColorVar, type Hex } from "@airdesign/doom"
import { describe, expect, it, vi } from "vitest"
import midnight from "../files/styles/midnight.json" with { type: "json" }
import { newDeckTheme, style, styleOf, styles, styleText } from "./index.js"
import { designedThemes, libraryArt } from "./style-art.js"

const backgrounds = ["background", "background2"] as const satisfies readonly ColorVar[]
const inks = paletteColorVars.filter((color) => color !== "background" && color !== "background2")

function linearChannel(color: Hex, offset: number): number {
  const srgb = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

const luminance = (color: Hex) =>
  0.2126 * linearChannel(color, 1) + 0.7152 * linearChannel(color, 3) + 0.0722 * linearChannel(color, 5)

describe("built-in styles", () => {
  it("lists every style file in id order", () => {
    const ids = styles.map(({ id }) => id)
    const files = readdirSync("packages/taste/files/styles").filter((file) => file.endsWith(".json"))
    expect(files.sort()).toEqual(ids.map((id) => `${id}.json`))
    expect(ids).toEqual([...ids].sort())
  })

  it("gives every style a text whose summary is its opening sentence", () => {
    for (const { id } of styles) {
      expect(styleText(id)?.summary).toMatch(/^For .+\.$/)
      expect(styleText(id)?.parameters.length).toBeGreaterThan(0)
    }
    expect(styleText("../index")).toBeUndefined()
    expect(styleText("editorial.md")).toBeUndefined()
  })

  it("reads a style's parameters from its Parameters section", () => {
    const text = styleText("editorial")!
    expect(text.markdown).toBe(readFileSync("packages/taste/files/styles/editorial.md", "utf8").trimEnd())
    expect(text.parameters.map(({ name }) => name)).toEqual(["accent", "kicker", "density"])
    expect(text.parameters[0]?.description).toMatch(/^the colour for the point that matters\./)
  })

  it("names accent1 as the point colour in every style's token map and default accent parameter", () => {
    for (const { id } of styles) {
      const text = styleText(id)!
      const tokenMap = text.markdown.split("## Token map")[1]!.split("\n## ")[0]!
      const pointLines = tokenMap
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.endsWith("One per slide."))
      expect(pointLines, `${id} token map point`).toHaveLength(1)
      expect(pointLines[0], `${id} token map point`).toMatch(/^- `accent1`: /)
      const accent = text.parameters.find(({ name }) => name === "accent")
      expect(accent?.description, `${id} accent parameter`).toContain("Default `accent1`")
    }
  })

  it("keeps every preset value apart from the Consulting accent and Technical title size", () => {
    const actual = Object.fromEntries(
      styles.map(({ id, theme }) => [id, createHash("sha256").update(JSON.stringify(theme)).digest("hex")]),
    )
    expect(actual).toEqual({
      consulting: "86dc328a90748794b044d900353127dc3bf4acac4ef01bc05ec41ce6b21f3835",
      editorial: "9b60e474ef40b369616d07fd2493a40482bd24788ea4755c596cb969a36489d3",
      midnight: "66af9b1a0e36c4ab16de6a2cee83dcd2780c00c95a45db92efe5c29623d8fae3",
      neutral: "b3429917b395d0fb5521e7be117b2640f33728ef73c590af9971acbaa8d214bb",
      technical: "5d735932823a91226cbd0d251f9e308d9c3381d3d69139d0e89960a56bff1efc",
    })
  })

  it.each(libraryArt)(
    "preserves $name art and inherits the slide type scale and effects",
    ({ id, name, accent1, heading }) => {
      expect(style(id)).toMatchObject({
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
    expect(styleOf({ ...theme, colors: { ...theme.colors } })?.id).toBe("neutral")
    expect(styleOf({ ...theme, fonts: { ...theme.fonts, body: "Lora" } })).toBeUndefined()
  })

  it.each(styles)("distinguishes gains and losses in $name", ({ id, theme }) => {
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
    const { colors } = style("consulting")!.theme
    expect((luminance(colors.accent1) + 0.05) / (luminance(colors.text) + 0.05)).toBeGreaterThanOrEqual(2)
  })

  it.each(designedThemes)("preserves $name art and type scale", ({ id, name, ...theme }) => {
    expect(style(id)).toMatchObject({ id, name, theme })
  })

  it.each(designedThemes)("meets WCAG AA for $name text on both background tokens", ({ id }) => {
    const entry = style(id)
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

describe("malformed built-in styles", () => {
  it("refuses a malformed color and names the style and field", async () => {
    vi.resetModules()
    vi.doMock("../files/styles/midnight.json", () => ({
      default: { ...midnight, colors: { ...midnight.colors, accent1: "6b9bff" } },
    }))
    try {
      await expect(import("./styles.js")).rejects.toThrow(/midnight\.json.*colors/)
    } finally {
      vi.doUnmock("../files/styles/midnight.json")
      vi.resetModules()
    }
  })
})

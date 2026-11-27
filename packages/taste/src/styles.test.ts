import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import midnight from "../files/styles/midnight.json" with { type: "json" }
import { newDeckTheme, style, styleOf, styles, styleText } from "./index.js"

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
    expect(text.parameters.map(({ name }) => name)).toEqual(["accent", "kicker", "density", "variant"])
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

  it.each(styles)("serves $name with the colours, fonts and type scale of its file", ({ id }) => {
    const file = JSON.parse(readFileSync(`packages/taste/files/styles/${id}.json`, "utf8")) as {
      readonly name: string
      readonly colors: object
      readonly fonts: object
      readonly textStyles: object
      readonly effectStyles: object
    }
    expect(style(id)).toMatchObject({
      id,
      name: file.name,
      theme: {
        colors: file.colors,
        fonts: file.fonts,
        textStyles: file.textStyles,
        effectStyles: file.effectStyles,
      },
    })
  })

  it("recognizes a stored copy and distinguishes a customized theme", () => {
    const theme = newDeckTheme
    expect(styleOf({ ...theme, colors: { ...theme.colors } })?.style.id).toBe("neutral")
    expect(styleOf({ ...theme, fonts: { ...theme.fonts, body: "Lora" } })).toBeUndefined()
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

  it.each([
    { fault: "an unknown colour", patch: { colors: { accent9: midnight.colors.accent1 } } },
    { fault: "an unknown text style", patch: { textStyles: { huge: { size: 200 } } } },
    { fault: "a text style out of range", patch: { textStyles: { body: { size: 0 } } } },
    { fault: "a font", patch: { fonts: { body: "Lora" } } },
  ])("refuses a variant with $fault and names the style and variant", async ({ patch }) => {
    vi.resetModules()
    vi.doMock("../files/styles/midnight.json", () => ({
      default: { ...midnight, variants: { ...midnight.variants, loud: patch } },
    }))
    try {
      await expect(import("./styles.js")).rejects.toThrow(/midnight\.json variant loud/)
    } finally {
      vi.doUnmock("../files/styles/midnight.json")
      vi.resetModules()
    }
  })
})

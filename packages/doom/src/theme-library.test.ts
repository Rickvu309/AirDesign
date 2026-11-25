import { describe, expect, it, vi } from "vitest"
import { defaultTheme, libraryThemeOf, themeLibrary } from "./index.js"
import { themeFiles } from "./library/theme-index.js"
import midnight from "./library/themes/midnight.json" with { type: "json" }
import { colorVars, signedColorVars, type ColorVar, type Hex } from "./paint.js"
import { designedThemes, fallbackArt, libraryArt } from "./testing/theme-library-art.js"

declare const process: {
  getBuiltinModule(name: "node:fs"): { readdirSync(path: string): string[] }
}

const backgrounds = ["background", "background2"] as const satisfies readonly ColorVar[]
const inks = colorVars.filter(
  (color) => !backgrounds.some((background) => color === background) && !signedColorVars.some((role) => color === role),
)

function linearChannel(color: Hex, offset: number): number {
  const srgb = Number.parseInt(color.slice(offset, offset + 2), 16) / 255
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
}

const luminance = (color: Hex) =>
  0.2126 * linearChannel(color, 1) + 0.7152 * linearChannel(color, 3) + 0.0722 * linearChannel(color, 5)

describe("built-in themes", () => {
  it("indexes every JSON file in the theme folder", () => {
    const { readdirSync } = process.getBuiltinModule("node:fs")
    const files = readdirSync("packages/doom/src/library/themes").filter((file) => file.endsWith(".json"))
    expect(Object.keys(themeFiles).sort(), "Regenerate with node packages/doom/theme-index.mjs").toEqual(files.sort())
  })

  it.each(libraryArt)(
    "preserves $name art and inherits the slide type scale and effects",
    ({ id, name, accent1, heading }) => {
      expect(themeLibrary[id]).toMatchObject({
        id,
        name,
        theme: {
          colors: { accent1 },
          fonts: { heading },
          textStyles: defaultTheme.textStyles,
          effectStyles: defaultTheme.effectStyles,
        },
      })
    },
  )

  it("recognizes a stored copy and distinguishes a customized theme", () => {
    const { theme } = themeLibrary.neutral
    expect(libraryThemeOf({ ...theme, colors: { ...theme.colors } })?.id).toBe("neutral")
    expect(libraryThemeOf({ ...theme, fonts: { ...theme.fonts, body: "Lora" } })).toBeUndefined()
  })

  it.each(Object.values(themeLibrary))("distinguishes gains and losses in $name", ({ id, theme }) => {
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

  it("preserves fallback art", () => {
    expect(defaultTheme).toMatchObject(fallbackArt)
  })

  it.each(designedThemes)("preserves $name art and type scale", ({ id, name, ...theme }) => {
    expect(themeLibrary[id]).toMatchObject({ id, name, theme })
  })

  it.each(designedThemes)("meets WCAG AA for $name text on both background tokens", ({ id }) => {
    const entry = themeLibrary[id]
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
  const { powerPoint: _powerPoint, ...withoutPowerPoint } = midnight

  it.each([
    { raw: { ...midnight, colors: { ...midnight.colors, accent1: "6b9bff" } }, field: "colors" },
    { raw: withoutPowerPoint, field: "powerPoint" },
  ])("refuses midnight.json and names the invalid $field field", async ({ raw, field }) => {
    vi.resetModules()
    vi.doMock("./library/themes/midnight.json", () => ({ default: raw }))
    try {
      const loaded = import("./theme.js")
      await expect(loaded).rejects.toBeInstanceOf(Error)
      await expect(loaded).rejects.toThrowError(
        expect.objectContaining({ message: expect.stringContaining(`midnight.json: ${field}`) }),
      )
    } finally {
      vi.doUnmock("./library/themes/midnight.json")
      vi.resetModules()
    }
  })
})

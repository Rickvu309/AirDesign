import { describe, expect, it, vi } from "vitest"
import { defaultTheme, themeLibrary } from "./index.js"
import { themeFiles } from "./library/theme-index.js"
import midnight from "./library/themes/midnight.json" with { type: "json" }
import { fallbackArt, libraryArt } from "./testing/theme-library-art.js"

declare const process: {
  getBuiltinModule(name: "node:fs"): { readdirSync(path: string): string[] }
}

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

  it("preserves fallback art", () => {
    expect(defaultTheme).toMatchObject(fallbackArt)
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

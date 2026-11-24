import { describe, expect, it } from "vitest"
import { defaultTheme, themeLibrary } from "./index.js"
import editorial from "./library/themes/editorial.json" with { type: "json" }
import midnight from "./library/themes/midnight.json" with { type: "json" }
import neutral from "./library/themes/neutral.json" with { type: "json" }

describe("built-in themes", () => {
  it.each([neutral, midnight, editorial])(
    "preserves $name art and inherits the slide type scale and effects",
    (entry) => {
      const builtIn = Object.entries(themeLibrary).find(([id]) => id === entry.id)?.[1]
      expect(builtIn).toEqual({
        name: entry.name,
        theme: {
          colors: entry.colors,
          fonts: entry.fonts,
          textStyles: defaultTheme.textStyles,
          effectStyles: defaultTheme.effectStyles,
        },
      })
    },
  )
})

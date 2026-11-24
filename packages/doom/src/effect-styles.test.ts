import { describe, expect, it } from "vitest"
import { defaultTheme } from "./theme.js"
import { theme } from "./sample-deck.js"

describe("effect styles", () => {
  it("makes glow a drop shadow with no offset in every theme, as Figma builds one", () => {
    for (const each of [defaultTheme, theme()]) {
      expect(each.effectStyles.glow).toEqual([expect.objectContaining({ kind: "dropShadow", x: 0, y: 0 })])
    }
  })
})

import { describe, expect, it } from "vitest"
import { theme } from "./sample-deck.js"
import { testTheme } from "./testing/theme.js"

describe("effect styles", () => {
  it("makes glow a drop shadow with no offset in every theme, as Figma builds one", () => {
    for (const each of [testTheme, theme()]) {
      expect(each.effectStyles.glow).toEqual([expect.objectContaining({ kind: "dropShadow", x: 0, y: 0 })])
    }
  })
})

import type { Design } from "@airdesign/document"
import { expect, it } from "vitest"
import { themedDesign } from "./theme-font.js"

it("names the theme font its palette gives now, and leaves a font named in the file as it is", () => {
  const fonts = { major: "Georgia", minor: "Calibri" }
  expect(themedDesign({ "text.font": ["+mj-lt", "master"], "text.size": [44] }, fonts)).toEqual({
    "text.font": ["Georgia", "master"],
    "text.size": [44],
  })
  expect(themedDesign({ "text.font": ["+mn-lt", "style"] }, fonts)).toEqual({ "text.font": ["Calibri", "style"] })
  const named: Design = { "text.font": ["Calibri Light", "master"] }
  expect(themedDesign(named, fonts)).toBe(named)
  expect(themedDesign({ "text.font": ["+mj-lt"], "text.size": [44] }, {})).toEqual({ "text.size": [44] })
})

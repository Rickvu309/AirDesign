import type { Design } from "@airdesign/document"
import { expect, it } from "vitest"
import { templateFontDesign } from "./template-font.js"

it("names the template font its palette gives now, and leaves a font named in the file as it is", () => {
  const fonts = { major: "Georgia", minor: "Calibri" }
  expect(templateFontDesign({ "text.font": ["+mj-lt", "master"], "text.size": [44] }, fonts)).toEqual({
    "text.font": ["Georgia", "master"],
    "text.size": [44],
  })
  expect(templateFontDesign({ "text.font": ["+mn-lt", "style"] }, fonts)).toEqual({ "text.font": ["Calibri", "style"] })
  const named: Design = { "text.font": ["Calibri Light", "master"] }
  expect(templateFontDesign(named, fonts)).toBe(named)
  expect(templateFontDesign({ "text.font": ["+mj-lt"], "text.size": [44] }, {})).toEqual({ "text.size": [44] })
})

import { expect, it } from "vitest"
import { pageRule, printWidth } from "./print-page"

const wide = { width: 12192000, height: 6858000 }
const standard = { width: 9144000, height: 6858000 }

it("prints each slide on a page of the slide's own size, with no margin", () => {
  expect(pageRule(wide)).toBe("@page { size: 13.3333in 7.5in; margin: 0; }")
  expect(pageRule(standard)).toBe("@page { size: 10in 7.5in; margin: 0; }")
})

it("paints a slide as wide as its page at the print resolution of CSS", () => {
  expect(printWidth(wide)).toBe(1280)
  expect(printWidth(standard)).toBe(960)
})

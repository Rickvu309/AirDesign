import { expect, it } from "vitest"
import { pageRule, printHeight, printWidth } from "./print-page"

it("prints a 16:9 deck on a 13.33 by 7.5 inch page, painted 1280 px wide", () => {
  const size = { w: 1920, h: 1080 }
  expect(printWidth).toBe(1280)
  expect(printHeight(size)).toBe(720)
  expect(pageRule(size)).toBe("@page { size: 13.3333in 7.5in; margin: 0; }")
})

it("keeps the deck's own shape for a page that is not 16:9", () => {
  const size = { w: 1024, h: 768 }
  expect(printHeight(size)).toBe(960)
  expect(pageRule(size)).toBe("@page { size: 13.3333in 10in; margin: 0; }")
})

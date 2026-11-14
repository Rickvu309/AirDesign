import { expect, it } from "vitest"
import { printDesign } from "./design-print.js"

it("prints one line per element: each field, its value, and where it comes from", () => {
  expect(
    printDesign({
      fill: ["accent1", "style"],
      "line.width": [1, "style"],
      "text.size": [36, "master"],
      "text.color": ["tx1", "master"],
      "text.bold": [true],
      "box.flipH": [true],
    }),
  ).toBe(
    "fill accent1 (style) · line.width 1 (style) · text.size 36 (master) · text.color tx1 (master) · text.bold · box.flipH",
  )
  expect(printDesign({ "text.bold": [false] })).toBe("text.bold false")
  expect(printDesign({})).toBe("")
})

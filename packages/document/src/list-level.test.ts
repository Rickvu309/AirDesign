import { expect, it } from "vitest"
import { levelNumbering, listIndent } from "./list-level.js"

it("sets each level's marker on PowerPoint's half-inch tab stops and hangs the text after it, a number a full stop", () => {
  expect([0, 1, 2].map((level) => listIndent(level, "bullets"))).toEqual([
    { marginLeft: 285_750, indent: -285_750 },
    { marginLeft: 742_950, indent: -285_750 },
    { marginLeft: 1_200_150, indent: -285_750 },
  ])
  expect(listIndent(1, "numbers")).toEqual({ marginLeft: 914_400, indent: -457_200 })
  expect(listIndent(2, "none")).toEqual({ marginLeft: 914_400, indent: 0 })
})

it("rotates numbers, letters and roman numerals with each level, as Figma does", () => {
  expect([0, 1, 2, 3, 4].map(levelNumbering)).toEqual([
    "arabicPeriod",
    "alphaLcPeriod",
    "romanLcPeriod",
    "arabicPeriod",
    "alphaLcPeriod",
  ])
})

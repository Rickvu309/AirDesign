import { openingChart } from "@airdesign/document"
import { expect, it } from "vitest"
import { gridFormat, gridNumber, gridParse } from "@/editor/chart-grid-number"

it("shows a chart's numbers in its own format, keeping one decimal of a share", () => {
  expect(gridNumber(0.4440873, "0%")).toBe("44.4%")
  expect(gridNumber(0.087201699999999993, "0.0%")).toBe("8.7%")
  expect(gridNumber(16.100000000000001, "General")).toBe("16.1")
  expect(gridNumber(1234.5, "$#,##0.0")).toBe("$1,234.5")
})

it("reads a typed share the way Excel does in a percent cell", () => {
  expect(gridParse("45%", "0%")).toBe(0.45)
  expect(gridParse("45", "0%")).toBe(0.45)
  expect(gridParse("0.45", "0%")).toBe(0.45)
  expect(gridParse("$1,234.5", "$#,##0.0")).toBe(1234.5)
  expect(gridParse("12", "General")).toBe(12)
  expect(gridParse("", "General")).toBeNull()
  expect(gridParse("abc", "General")).toBeNull()
})

it("takes the numbers' own format first, then the data labels' format, unless a pie's labels show shares", () => {
  const bar = openingChart("bar")
  expect(gridFormat("0%", bar)).toBe("0%")
  expect(gridFormat("General", { ...bar, labels: "$#,##0" })).toBe("$#,##0")
  expect(gridFormat(undefined, { ...openingChart("pie"), labels: "0%" })).toBe("General")
  expect(gridFormat(undefined, bar)).toBe("General")
})

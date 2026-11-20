import { expect, it } from "vitest"
import { chartNumber } from "./chart-number.js"

it("writes General numbers the way a spreadsheet shows them", () => {
  expect(chartNumber(96, "General")).toBe("96")
  expect(chartNumber(16.100000000000001, "General")).toBe("16.1")
  expect(chartNumber(-2.5, "General")).toBe("-2.5")
  expect(chartNumber(0, "General")).toBe("0")
})

it("writes General between literal signs, as a waterfall's change labels say +12 and -14", () => {
  expect(chartNumber(12, '"+"General;"+"General')).toBe("+12")
  expect(chartNumber(-12.5, '"+"General;"+"General')).toBe("+12.5")
  expect(chartNumber(14, '"-"General;"-"General')).toBe("-14")
  expect(chartNumber(1234.5, '"+"$#,##0.0;"+"$#,##0.0')).toBe("+$1,234.5")
  expect(chartNumber(7, '"+25"')).toBe("+25")
})

it("writes percent formats from the stored fraction", () => {
  expect(chartNumber(0.24836630000000001, "0%")).toBe("25%")
  expect(chartNumber(8.7201699999999993e-2, "0%")).toBe("9%")
  expect(chartNumber(0.4441, "0.0%")).toBe("44.4%")
})

it("writes fixed decimals, optional decimals and thousands", () => {
  expect(chartNumber(1234.5, "#,##0")).toBe("1,235")
  expect(chartNumber(1234.5, "#,##0.00")).toBe("1,234.50")
  expect(chartNumber(3.1, "0.0#")).toBe("3.1")
  expect(chartNumber(3.14159, "0.0#")).toBe("3.14")
  expect(chartNumber(0.5, "#.0")).toBe(".5")
})

it("keeps literal text, currency tags and a negative section", () => {
  expect(chartNumber(1200, '"$"#,##0')).toBe("$1,200")
  expect(chartNumber(1200, "[$€-407]#,##0")).toBe("€1,200")
  expect(chartNumber(-1200, "$#,##0;($#,##0)")).toBe("($1,200)")
  expect(chartNumber(-3, "0")).toBe("-3")
  expect(chartNumber(12, '0" km"')).toBe("12 km")
})

it("refuses a format it cannot write rather than guess", () => {
  expect(chartNumber(45000, "m/d/yyyy")).toBeNull()
  expect(chartNumber(1200, "0.00E+00")).toBeNull()
  expect(chartNumber(1200, "[>1000]0")).toBeNull()
  expect(chartNumber(1200, "#,##0,")).toBeNull()
})

import { describe, expect, it } from "vitest"
import { chartLimits, openingChart, readChartValue, writeChartValue, type ChartValue } from "./index.js"

describe("chart value", () => {
  const revenue: ChartValue = {
    kind: "bar",
    categories: ["Q1", "Q2", "Q3"],
    series: [
      { name: "2025", values: [4.1, 4.6, 5] },
      { name: "2026", values: [4.4, 5.1, 5.7] },
    ],
  }

  it("reads back what it writes, and opens each kind with sample data a person replaces", () => {
    expect(readChartValue(writeChartValue(revenue))).toEqual(revenue)
    for (const kind of ["bar", "line", "pie"] as const) {
      const opened = openingChart(kind)
      expect(opened.kind).toBe(kind)
      expect(opened.series.every((series) => series.values.length === opened.categories.length)).toBe(true)
      expect(readChartValue(writeChartValue(opened))).toEqual(opened)
    }
    expect(openingChart("pie").series).toHaveLength(1)
  })

  it("refuses a value that a chart cannot be drawn from", () => {
    const read = (value: object) => readChartValue(JSON.stringify(value))
    expect(read({ ...revenue, kind: "radar" })).toBeNull()
    expect(read({ ...revenue, categories: [] })).toBeNull()
    expect(read({ ...revenue, series: [] })).toBeNull()
    expect(read({ ...revenue, series: [{ name: "2025", values: [1, 2] }] })).toBeNull()
    expect(read({ ...revenue, series: [{ name: "2025", values: [1, Number.NaN, 2] }] })).toBeNull()
    expect(read({ ...revenue, categories: Array.from({ length: chartLimits.categories + 1 }, () => "x") })).toBeNull()
    expect(read({ ...revenue, extra: 1 })).toBeNull()
    expect(readChartValue("not json")).toBeNull()
  })
})

import { describe, expect, it } from "vitest"
import {
  chartFormats,
  chartKinds,
  chartLegends,
  chartLimits,
  openingChart,
  readChartValue,
  writeChartValue,
  type ChartValue,
} from "./index.js"

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
    expect(chartKinds).toEqual(["bar", "stacked", "stacked100", "horizontal", "waterfall", "line", "pie"])
    for (const kind of chartKinds) {
      const opened = openingChart(kind)
      expect(opened.kind).toBe(kind)
      expect(opened.series.every((series) => series.values.length === opened.categories.length)).toBe(true)
      expect(readChartValue(writeChartValue(opened))).toEqual(opened)
    }
    expect(openingChart("pie").series).toHaveLength(1)
  })

  it("reads back a waterfall's totals, and refuses totals a waterfall cannot draw", () => {
    const bridge = openingChart("waterfall")
    expect(bridge.totals).toEqual([0, 5])
    expect(bridge.series).toHaveLength(1)
    expect(readChartValue(writeChartValue({ ...bridge, totals: [5, 0] }))?.totals).toEqual([0, 5])
    const read = (value: object) => readChartValue(JSON.stringify(value))
    expect(read({ ...bridge, totals: [6] })).toBeNull()
    expect(read({ ...bridge, totals: [-1] })).toBeNull()
    expect(read({ ...bridge, totals: [1.5] })).toBeNull()
    expect(read({ ...bridge, totals: [2, 2] })).toBeNull()
    expect(read({ ...bridge, totals: "0" })).toBeNull()
    expect(read({ ...revenue, totals: [0] })).toBeNull()
    expect(read({ ...bridge, totals: [] })).toEqual({ ...bridge, totals: [] })
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

  it("reads back a consulting chart's title, data labels, axis, gridlines, gap, series colours and legend", () => {
    const styled: ChartValue = {
      ...revenue,
      series: [
        { name: "2025", values: [4.1, 4.6, 5], color: { rgb: "1F4E79" } },
        { name: "2026", values: [4.4, 5.1, 5.7], color: { scheme: "accent2" } },
      ],
      title: "Revenue grows 12% a year",
      labels: "#,##0.0",
      axis: false,
      gridlines: false,
      gap: 50,
      legend: "top",
    }
    expect(readChartValue(writeChartValue(styled))).toEqual(styled)
    expect(chartFormats).toContain("0%")
    expect(chartLegends).toEqual(["bottom", "top", "right", "left", "none"])
  })

  it("refuses a setting a PowerPoint chart cannot hold", () => {
    const read = (value: object) => readChartValue(JSON.stringify({ ...revenue, ...value }))
    expect(read({ labels: "0.000 widgets" })).toBeNull()
    expect(read({ gap: -1 })).toBeNull()
    expect(read({ gap: chartLimits.gap + 1 })).toBeNull()
    expect(read({ gap: 12.5 })).toBeNull()
    expect(read({ legend: "middle" })).toBeNull()
    expect(read({ axis: "no" })).toBeNull()
    expect(read({ title: "x".repeat(chartLimits.title + 1) })).toBeNull()
    expect(read({ series: [{ name: "2025", values: [1, 2, 3], color: { rgb: "blue" } }] })).toBeNull()
  })

  it("reads back a colour for each slice or bar, and the axis titles", () => {
    const pie: ChartValue = {
      kind: "pie",
      categories: ["North", "South", "East"],
      series: [
        {
          name: "Share",
          values: [0.5, 0.3, 0.2],
          colors: [{ rgb: "1F4E79" }, { scheme: "accent2" }, { rgb: "BFBFBF" }],
        },
      ],
    }
    expect(readChartValue(writeChartValue(pie))).toEqual(pie)
    const titled: ChartValue = { ...revenue, valueTitle: "Revenue ($M)", categoryTitle: "Quarter" }
    expect(readChartValue(writeChartValue(titled))).toEqual(titled)
    const read = (value: object) => readChartValue(JSON.stringify({ ...revenue, ...value }))
    expect(read({ series: [{ name: "2025", values: [1, 2, 3], colors: [{ rgb: "1F4E79" }] }] })).toBeNull()
    expect(read({ series: [{ name: "2025", values: [1, 2, 3], colors: [{ rgb: "blue" }, null, null] }] })).toBeNull()
    expect(read({ valueTitle: "x".repeat(chartLimits.title + 1) })).toBeNull()
    expect(read({ categoryTitle: 4 })).toBeNull()
  })
})

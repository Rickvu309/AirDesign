import {
  chartLimits,
  openingChart,
  readChartValue,
  waterfallColor,
  writeChartValue,
  type ChartValue,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { pastedChart } from "@/editor/chart-grid-paste"

const number = (text: string) => {
  const value = Number(text.replaceAll(",", ""))
  return text.trim() === "" || Number.isNaN(value) ? null : value
}

const bar: ChartValue = {
  kind: "bar",
  categories: ["2021", "2022"],
  series: [{ name: "Large", values: [1, 2] }],
}

describe("cells pasted into a chart's Data grid", () => {
  it("fills labels and values from the label cell pasted into, and adds the rows and series the block needs", () => {
    const next = pastedChart(
      bar,
      { row: 0, column: 0 },
      [
        ["2021", "10", "4"],
        ["2022", "12", "5"],
        ["2023", "1,300", "6"],
      ],
      number,
    )
    expect(next.categories).toEqual(["2021", "2022", "2023"])
    expect(next.series.map((series) => series.values)).toEqual([
      [10, 12, 1300],
      [4, 5, 6],
    ])
    expect(next.series[1]?.name).toBe("Series 2")
    expect(readChartValue(writeChartValue(next))).not.toBeNull()
  })

  it("names series from the header cells and keeps a value whose pasted text is not a number", () => {
    const next = pastedChart(bar, { row: -1, column: 1 }, [["Mid"], ["n/a"], ["7"]], number)
    expect(next.series.map((series) => [series.name, ...series.values])).toEqual([["Mid", 1, 7]])
  })

  it("stops at the chart's limits, keeps one series on a pie, and clips long labels", () => {
    const pie = openingChart("pie")
    const wide = pastedChart(pie, { row: 0, column: 1 }, [["1", "2", "3"]], number)
    expect(wide.series).toHaveLength(1)
    const tall = pastedChart(
      bar,
      { row: 0, column: 0 },
      Array.from({ length: 40 }, () => ["x".repeat(200)]),
      number,
    )
    expect(tall.categories).toHaveLength(chartLimits.categories)
    expect(tall.categories[0]).toHaveLength(chartLimits.label)
    expect(readChartValue(writeChartValue(tall))).not.toBeNull()
  })
})

describe("cells pasted into a waterfall's Data grid", () => {
  it("fills its one series, keeps its totals, and gives a new coloured bar the increase colour", () => {
    const bridge = openingChart("waterfall")
    const coloured: ChartValue = {
      ...bridge,
      series: bridge.series.map((series) => ({ ...series, colors: series.values.map(() => ({ rgb: "1F3A5F" })) })),
    }
    const next = pastedChart(
      coloured,
      { row: 5, column: 0 },
      [
        ["FY25", "130", "9"],
        ["FY26", "4", "7"],
      ],
      number,
    )
    expect(next.series).toHaveLength(1)
    expect(next.series[0]?.values).toEqual([100, 12, 18, 9, -14, 130, 4])
    expect(next.totals).toEqual([0, 5])
    expect(next.series[0]?.colors?.at(-1)).toEqual(waterfallColor("increase"))
    expect(readChartValue(writeChartValue(next))).toEqual(next)
  })
})

import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { chartAddRow, chartAddSeries, chartCell, chartDropRow, chartRow, chartSeriesName } from "./chart-data-writes"
import { hexes } from "./testing/design-adapter-art"

describe("chart data", () => {
  const chart = { kind: "column", categories: ["a", "b"], series: [{ name: "s", values: [1, 2] }] } as const

  it("edits a cell and a category name", () => {
    expect(chartCell(chart, 0, 1, 9).series[0]?.values).toEqual([1, 9])
    expect(chartRow(chart, 0, "z").categories).toEqual(["z", "b"])
  })

  it("adds and drops a row across every series, never the last one", () => {
    const added = chartAddRow(chart)
    expect(added.categories).toHaveLength(3)
    expect(added.series[0]?.values).toEqual([1, 2, 0])
    expect(chartDropRow(added, 0).series[0]?.values).toEqual([2, 0])
    expect(chartDropRow({ ...chart, categories: ["a"], series: [{ name: "s", values: [1] }] }, 0).categories).toEqual([
      "a",
    ])
  })

  it("keeps each point colour on its own category when a person renames, adds or drops a row", () => {
    const pointed: doom.Chart = {
      ...chart,
      categories: ["a", "b", "c"],
      series: [
        {
          name: "s",
          values: [1, 2, 3],
          points: [
            { at: 0, color: hexes.blue },
            { at: 2, color: { var: "accent3" } },
          ],
        },
      ],
    }
    expect(chartRow(pointed, 2, "z").series[0]?.points).toEqual(pointed.series[0]?.points)
    expect(chartAddRow(pointed).series[0]?.points).toEqual(pointed.series[0]?.points)
    expect(chartDropRow(pointed, 0).series[0]?.points).toEqual([{ at: 1, color: { var: "accent3" } }])
    expect(chartDropRow(pointed, 1).series[0]?.points).toEqual([
      { at: 0, color: hexes.blue },
      { at: 1, color: { var: "accent3" } },
    ])
  })

  it("names a series, and keeps the old name for an empty or unchanged one", () => {
    const two = chartAddSeries(chart)
    expect(chartSeriesName(two, 1, "  Plan  ").series.map((each) => each.name)).toEqual(["s", "Plan"])
    expect(chartSeriesName(two, 0, "Actual").series[1]?.name).toBe("Series 2")
    expect(chartSeriesName(two, 1, "   ")).toBe(two)
    expect(chartSeriesName(two, 0, "s")).toBe(two)
    expect(chartSeriesName(two, 7, "Nobody")).toBe(two)
  })

  it("adds a series with a value for each category", () => {
    expect(chartAddSeries(chart).series[1]).toEqual({ name: "Series 2", values: [0, 0] })
  })
})

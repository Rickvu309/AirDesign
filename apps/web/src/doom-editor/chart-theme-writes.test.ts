import { doom } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import {
  chartAddRow,
  chartAddSeries,
  chartCell,
  chartDropRow,
  chartRow,
  chartSeriesName,
  themeColorWrites,
} from "./chart-theme-writes"
import { hexes } from "./design-adapter-art"
import { grow, landed, paint, spot } from "./doom-fixtures"

const sampleHexes = hexes
const built = grow([{ type: "shape", name: "rect", props: { box: spot(100, 100, 200, 100), fills: paint } }])

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

describe("theme colours", () => {
  it("writes the deck's theme with one colour changed, keeping the rest", () => {
    const view = built.view
    const writes = themeColorWrites(view, "accent1", sampleHexes.themeTyped)
    expect(writes).toHaveLength(1)
    const after = landed(view, writes)
    const theme = doom.deckOf(after).theme
    expect(theme.colors.accent1).toBe(sampleHexes.theme)
    expect(theme.colors.accent2).toBe(doom.deckOf(view).theme.colors.accent2)
    expect(theme.fonts).toEqual(doom.deckOf(view).theme.fonts)
  })

  it("writes nothing for a word that is not a six digit hex, or for the colour it already is", () => {
    const view = built.view
    expect(themeColorWrites(view, "accent1", "red")).toEqual([])
    expect(themeColorWrites(view, "accent1", "#12345")).toEqual([])
    expect(themeColorWrites(view, "accent1", doom.deckOf(view).theme.colors.accent1.toUpperCase())).toEqual([])
  })
})

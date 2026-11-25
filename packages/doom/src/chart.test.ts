import { describe, expect, it } from "vitest"
import { readChart } from "./chart.js"
import { swatches } from "./testing/doom-fixtures-art.js"

const largest = {
  kind: "column",
  categories: Array.from({ length: 200 }, (_, at) => `${String(at)} ${"x".repeat(190)}`),
  series: Array.from({ length: 20 }, (_, index) => ({
    name: `${String(index)} ${"y".repeat(190)}`,
    values: Array.from({ length: 200 }, () => 1),
    points: Array.from({ length: 200 }, (_, at) => ({ at, color: swatches.custom })),
  })),
}

describe("readChart", () => {
  it("reads a colour for every point of the largest chart, however long its names", () => {
    const chart = readChart(largest)
    expect(chart.series.flatMap((series) => series.points ?? [])).toHaveLength(4000)
  })

  it("refuses a point past the last category, and two colours for one point", () => {
    const one = { kind: "pie", categories: ["A", "B"], series: [{ name: "Share", values: [1, 2] }] }
    const withPoints = (points: unknown) => () => readChart({ ...one, series: [{ ...one.series[0], points }] })
    expect(withPoints([{ at: 2, color: swatches.custom }])).toThrow()
    expect(withPoints([{ at: 0.5, color: swatches.custom }])).toThrow()
    expect(
      withPoints([
        { at: 1, color: swatches.custom },
        { at: 1, color: swatches.recoloured },
      ]),
    ).toThrow()
    expect(readChart({ ...one, series: [{ ...one.series[0], points: [{ at: 1, color: swatches.custom }] }] })).toEqual({
      ...one,
      series: [{ ...one.series[0], points: [{ at: 1, color: swatches.custom }] }],
    })
  })

  it("has no meaning for a series colour on a pie, so a pie reads without one and keeps its slice colours", () => {
    const pie = {
      kind: "pie",
      categories: ["A", "B"],
      series: [
        { name: "Share", values: [1, 2], color: swatches.custom, points: [{ at: 1, color: swatches.recoloured }] },
      ],
    }
    expect(readChart(pie).series[0]).toEqual({
      name: "Share",
      values: [1, 2],
      points: [{ at: 1, color: swatches.recoloured }],
    })
    expect(readChart({ ...pie, kind: "column" }).series[0]?.color).toEqual(swatches.custom)
  })
})

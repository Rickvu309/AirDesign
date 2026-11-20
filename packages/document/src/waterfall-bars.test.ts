import { describe, expect, it } from "vitest"
import { openingChart, waterfallBars, type ChartValue } from "./index.js"

const bridge = (values: readonly number[], totals: readonly number[]): ChartValue => ({
  kind: "waterfall",
  categories: values.map((_, at) => `Step ${String(at + 1)}`),
  series: [{ name: "Revenue", values }],
  totals,
})

describe("waterfall bars", () => {
  it("floats each change from the level the bars before it reached, and stands each total on the axis", () => {
    expect(waterfallBars(openingChart("waterfall"))).toEqual([
      { start: 0, end: 100, role: "total" },
      { start: 100, end: 112, role: "increase" },
      { start: 112, end: 130, role: "increase" },
      { start: 130, end: 139, role: "increase" },
      { start: 139, end: 125, role: "decrease" },
      { start: 0, end: 125, role: "total" },
    ])
  })

  it("restarts the bars after a subtotal from the subtotal's own number, as PowerPoint's Set as total does", () => {
    expect(waterfallBars(bridge([50, -20, 25, 10], [0, 2]))).toEqual([
      { start: 0, end: 50, role: "total" },
      { start: 50, end: 30, role: "decrease" },
      { start: 0, end: 25, role: "total" },
      { start: 25, end: 35, role: "increase" },
    ])
  })

  it("lets a change cross zero, and starts from zero when the first bar is a change", () => {
    expect(waterfallBars(bridge([10, -25, 30], []))).toEqual([
      { start: 0, end: 10, role: "increase" },
      { start: 10, end: -15, role: "decrease" },
      { start: -15, end: 15, role: "increase" },
    ])
  })
})

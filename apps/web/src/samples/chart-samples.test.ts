import { expect, it } from "vitest"
import { barChartComponents, barCharts } from "./slides/bar-charts"

it("shows quarterly stacked revenue in thousands while retaining millions for the ranking", () => {
  const [ranking, quarterly] = barChartComponents
  expect(ranking?.data.series[0]).toMatchObject({ values: [1.9, 1.2, 0.7, 0.5, 0.3] })
  expect(quarterly?.data.segments?.map(({ value }) => value)).toEqual([720, 200, 800, 240, 880, 290, 970, 340])
  expect(JSON.stringify(barCharts())).toContain("Revenue by quarter, 2025, $K")
})

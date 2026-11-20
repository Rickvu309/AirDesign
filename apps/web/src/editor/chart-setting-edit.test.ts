import { openingChart, type ChartValue } from "@airdesign/document"
import { chartNumber } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { gridFormat, gridNumber } from "@/editor/chart-grid-number"
import { chartSettingEdited } from "@/editor/chart-setting-edit"

it("shows typed whole numbers as whole numbers once data labels are turned on, as PowerPoint's General does", () => {
  const typed: ChartValue = {
    ...openingChart("bar"),
    series: [{ name: "Market ($B)", values: [12, 25, 4.5, 1234] }],
  }
  const labelled = chartSettingEdited(typed, "labels", true)
  expect(labelled.labels).toBe("General")
  const format = gridFormat(undefined, labelled)
  expect(typed.series[0]?.values.map((value) => gridNumber(value, format))).toEqual(["12", "25", "4.5", "1234"])
  expect(typed.series[0]?.values.map((value) => chartNumber(value, labelled.labels ?? ""))).toEqual([
    "12",
    "25",
    "4.5",
    "1234",
  ])
  expect(chartSettingEdited(labelled, "labels", false).labels).toBeUndefined()
})

import { openingChart, type ChartValue } from "@airdesign/document"
import { chartNumber } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { gridFormat, gridNumber } from "@/editor/chart-grid-number"
import {
  chartKindEdited,
  chartSettingEdited,
  roleColor,
  totalToggled,
  totalsWithoutRow,
} from "@/editor/chart-setting-edit"

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

it("marks a waterfall row as a total, drops totals when the chart becomes another kind, and shifts them past a removed row", () => {
  const bridge = openingChart("waterfall")
  expect(totalToggled(bridge, 2).totals).toEqual([0, 2, 5])
  expect(totalToggled(bridge, 5).totals).toEqual([0])
  expect(chartKindEdited(bridge, "bar")).not.toHaveProperty("totals")
  expect(chartKindEdited(bridge, "bar").kind).toBe("bar")
  expect(chartKindEdited(openingChart("bar"), "waterfall").kind).toBe("waterfall")
  expect(totalsWithoutRow([0, 3, 5], 3)).toEqual([0, 4])
  expect(totalsWithoutRow([0, 3, 5], 1)).toEqual([0, 2, 4])
})

it("recolours every bar of one waterfall role, and goes back to automatic colours when they match", () => {
  const bridge = openingChart("waterfall")
  const green = { rgb: "2E7D32" }
  const greened = chartSettingEdited(bridge, "role.increase", green)
  expect(roleColor(greened, "increase")).toEqual(green)
  expect(greened.series[0]?.colors?.filter((color) => "rgb" in color && color.rgb === "2E7D32")).toHaveLength(3)
  const back = chartSettingEdited(greened, "role.increase", roleColor(bridge, "increase"))
  expect(back.series[0]).not.toHaveProperty("colors")
})

import { openingChart, type ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { chartValueOf } from "./chart-read.js"
import { chartSpaceXml } from "./chart-space.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { encodeUtf8 } from "./package-bytes.js"
import { readPackage } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const written = (chart: ChartValue) => chartValueOf(encodeUtf8(chartSpaceXml(chart, "rId1")))

const consulting: ChartValue = {
  kind: "bar",
  categories: ["FY23", "FY24", "FY25"],
  series: [
    { name: "Core", values: [41, 46, 52], color: { rgb: "1F4E79" } },
    { name: "New", values: [3, 7, 12], color: { scheme: "accent4" } },
  ],
  title: "New products add a fifth of growth",
  labels: "#,##0",
  axis: false,
  gridlines: false,
  gap: 40,
  legend: "top",
}

it("reads back every setting it writes, for each kind", () => {
  expect(written(consulting)).toEqual(consulting)
  const { gap: _, ...rest } = consulting
  const line: ChartValue = { ...rest, kind: "line", labels: "0.0%", legend: "right" }
  expect(written(line)).toEqual(line)
  const pie: ChartValue = {
    kind: "pie",
    categories: ["North", "South"],
    series: [{ name: "Share", values: [0.6, 0.4] }],
    labels: "0%",
    legend: "none",
  }
  expect(written(pie)).toEqual(pie)
  for (const kind of ["bar", "line", "pie"] as const) expect(written(openingChart(kind))).toEqual(openingChart(kind))
})

it("reads nothing from a chart kind it cannot write, so that chart stays as it is", () => {
  const xml = chartSpaceXml(consulting, "rId1")
  const as = (from: string, to: string) => chartValueOf(encodeUtf8(xml.replace(from, to)))
  expect(as('<c:grouping val="clustered"/>', '<c:grouping val="stacked"/>')).toBeNull()
  expect(as('<c:barDir val="col"/>', '<c:barDir val="bar"/>')).toBeNull()
  expect(as("<c:barChart>", "<c:bar3DChart>")).toBeNull()
  expect(
    as("<c:invertIfNegative", '<c:trendline><c:trendlineType val="linear"/></c:trendline><c:invertIfNegative'),
  ).toBeNull()
  expect(as("<c:v>46</c:v>", "<c:v></c:v>")).toBeNull()
})

it("reads PowerPoint's own pie charts, and finds their caches match their workbooks", async () => {
  const file = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`)
  const read = await readPackage(file)
  if (!read.ok) throw new Error("census")
  const charts = [1, 2, 3, 4].map((at) => chartValueOf(read.parts.get(`ppt/charts/chart${String(at)}.xml`)!))
  expect(charts.map((chart) => chart?.kind)).toEqual(["pie", "pie", "pie", "pie"])
  expect(charts.every((chart) => chart !== null && chart.categories.length === chart.series[0]?.values.length)).toBe(
    true,
  )
  expect(chartWorkbookErrors(read.parts)).toEqual([])
})

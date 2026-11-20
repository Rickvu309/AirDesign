import { openingChart, writeChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { readAddChange, readSetChange, toolInputSchema } from "./index.js"

const value = writeChartValue(openingChart("line"))

it("reads an agent's chart add with its data, and a set of a chart's data", () => {
  expect(readAddChange({ op: "add", kind: "chart", slide: "258", chart: { value } })).toEqual({
    ok: true,
    change: { op: "add", kind: "chart", slide: "258", chart: { value } },
  })
  expect(readAddChange({ op: "add", kind: "chart", slide: "258" }).ok).toBe(false)
  expect(readAddChange({ op: "add", kind: "chart", slide: "258", chart: { value: "{}" } }).ok).toBe(false)
  expect(readAddChange({ op: "add", kind: "shape", slide: "258", chart: { value } }).ok).toBe(false)
  expect(readSetChange({ op: "set", target: "258.7", chart: { value } }).ok).toBe(true)
  expect(JSON.stringify(toolInputSchema("edit_deck"))).toContain('"chart"')
})

it("reads an agent's consulting chart with its title, labels, axis, gridlines, gap, colours and legend", () => {
  const styled = JSON.stringify({
    kind: "bar",
    categories: ["FY24", "FY25"],
    series: [{ name: "Revenue", values: [4.1, 4.6], color: { rgb: "1F4E79" } }],
    title: "Revenue grows",
    labels: "$#,##0.0",
    axis: false,
    gridlines: false,
    gap: 50,
    legend: "none",
  })
  expect(readAddChange({ op: "add", kind: "chart", slide: "258", chart: { value: styled } }).ok).toBe(true)
  const unknownFormat = styled.replace('"$#,##0.0"', '"0.0 widgets"')
  expect(readAddChange({ op: "add", kind: "chart", slide: "258", chart: { value: unknownFormat } }).ok).toBe(false)
})

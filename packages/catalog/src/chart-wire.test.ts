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

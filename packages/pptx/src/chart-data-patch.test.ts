import { expect, it } from "vitest"
import { chartValueOf } from "./chart-read.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { chartPartOf, writeChart } from "./chart-write.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readPackage, readShapes } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function census() {
  const file = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`)
  const read = await readPackage(file)
  if (!read.ok) throw new Error("census")
  const shape = readShapes(read.parts).find((each) => each.contentKind === "chart")
  if (shape === undefined) throw new Error("chart")
  const chartPart = chartPartOf(read.parts, shape.part, shape.shape)
  const chart = chartValueOf(read.parts.get(chartPart)!)
  if (chart === null) throw new Error("value")
  return { parts: read.parts, shape, chartPart, chart }
}

it("changes only the edited number in a PowerPoint chart and its workbook, keeping the chart's own look", async () => {
  const { parts, shape, chartPart, chart } = await census()
  const [first] = chart.series
  if (first === undefined) throw new Error("series")
  const edited = { ...chart, series: [{ ...first, values: [42, ...first.values.slice(1)] }] }
  const next = writeChart(parts, shape.part, shape.shape, edited)
  const before = decodeUtf8(parts.get(chartPart)!)
  const after = decodeUtf8(next.get(chartPart)!)
  expect(after.length - before.length).toBe("42".length - String(first.values[0]).length)
  expect(after.replace("<c:v>42</c:v>", "")).toBe(before.replace(`<c:v>${String(first.values[0])}</c:v>`, ""))
  expect(chartValueOf(next.get(chartPart)!)?.series[0]?.values[0]).toBe(42)
  expect(chartWorkbookErrors(next)).toEqual([])
  const changed = [...next.keys()].filter((name) => next.get(name) !== parts.get(name))
  expect(changed).toHaveLength(2)
})

it("rewrites a PowerPoint chart in AirDesign's style when a setting changes", async () => {
  const { parts, shape, chartPart, chart } = await census()
  const next = writeChart(parts, shape.part, shape.shape, { ...chart, title: "Housing" })
  expect(decodeUtf8(next.get(chartPart)!)).toContain("<a:t>Housing</a:t>")
  expect(chartWorkbookErrors(next)).toEqual([])
})

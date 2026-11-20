import { openingChart, type ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { addChart, writeChart } from "./chart-write.js"
import { decodeUtf8 } from "./package-bytes.js"
import { paintReader, readPackage, readShapes } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function blank() {
  const read = await readPackage(
    process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`),
  )
  if (!read.ok) throw new Error("blank")
  return read.parts
}

const slide = "ppt/slides/slide1.xml"
const box = { x: 914_400, y: 914_400, cx: 6_096_000, cy: 3_429_000 }

function painted(parts: ReadonlyMap<string, Uint8Array>) {
  return paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.chart !== undefined)?.chart
}

it("adds a native column, line or pie chart with its own part, relationship and content type, which paints back", async () => {
  for (const kind of ["bar", "line", "pie"] as const) {
    const parts = new Map(await blank())
    addChart(parts, { part: slide, id: 9, ...box, chart: openingChart(kind) })
    expect(parts.has("ppt/charts/chart1.xml")).toBe(true)
    expect(decodeUtf8(parts.get("[Content_Types].xml")!)).toContain(
      '<Override PartName="/ppt/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>',
    )
    expect(decodeUtf8(parts.get("ppt/slides/_rels/slide1.xml.rels")!)).toContain('Target="../charts/chart1.xml"')
    expect(readShapes(parts).find((shape) => shape.shape === "9")?.contentKind).toBe("chart")
    const chart = painted(parts)
    expect(chart?.kind).toBe(kind === "bar" ? "column" : kind)
    expect(chart?.categories).toEqual(["Q1", "Q2", "Q3", "Q4"])
    expect(chart?.series[0]?.values).toEqual([4.1, 4.6, 5, 5.4])
  }
})

it("rewrites the chart's data in place and keeps its part, relationship and frame", async () => {
  const parts = new Map(await blank())
  addChart(parts, { part: slide, id: 9, ...box, chart: openingChart("bar") })
  const growth: ChartValue = {
    kind: "line",
    categories: ["2024", "2025"],
    series: [{ name: "EBITDA", values: [12, 15.5] }],
  }
  const next = writeChart(parts, slide, "9", growth)
  expect([...next.keys()].filter((name) => name.startsWith("ppt/charts/"))).toEqual(["ppt/charts/chart1.xml"])
  const chart = painted(next)
  expect(chart?.kind).toBe("line")
  expect(chart?.categories).toEqual(["2024", "2025"])
  expect(chart?.series.map((series) => [series.name, series.values])).toEqual([["EBITDA", [12, 15.5]]])
})

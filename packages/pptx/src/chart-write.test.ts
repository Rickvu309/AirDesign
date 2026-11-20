import { openingChart, writeChartValue, type ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { addChart, writeChart } from "./chart-write.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { chartXml } from "./trait-xml-chart.js"
import { partData, readContainer } from "./package-container.js"
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
  expect([...next.keys()].filter((name) => name.startsWith("ppt/charts/"))).toEqual([
    "ppt/charts/_rels/chart1.xml.rels",
    "ppt/charts/chart1.xml",
  ])
  const chart = painted(next)
  expect(chart?.kind).toBe("line")
  expect(chart?.categories).toEqual(["2024", "2025"])
  expect(chart?.series.map((series) => [series.name, series.values])).toEqual([["EBITDA", [12, 15.5]]])
})

const workbook = "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx"

function workbookCells(bytes: Uint8Array): readonly (readonly string[])[] {
  const files = new Map(readContainer(bytes).map((record) => [record.name, decodeUtf8(partData(record)!)]))
  const strings = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((found) =>
    (found[1] ?? "").replaceAll("&amp;", "&"),
  )
  const rows = [...(files.get("xl/worksheets/sheet1.xml") ?? "").matchAll(/<row r="(\d+)">(.*?)<\/row>/g)]
  return rows.map((row) => {
    const cells = [...(row[2] ?? "").matchAll(/<c r="([A-Z]+)\d+"( t="s")?><v>([^<]*)<\/v><\/c>/g)]
    const width = Math.max(...cells.map((found) => (found[1] ?? "A").charCodeAt(0) - 64))
    const line = Array.from({ length: width }, () => "")
    for (const [, column, shared, value] of cells)
      line[(column ?? "A").charCodeAt(0) - 65] = shared === undefined ? (value ?? "") : (strings[Number(value)] ?? "")
    return line
  })
}

it("embeds a workbook of the chart's numbers and links it as PowerPoint does, so Edit Data opens them", async () => {
  const parts = new Map(await blank())
  addChart(parts, { part: slide, id: 9, ...box, chart: openingChart("bar") })
  expect(parts.has(workbook)).toBe(true)
  expect(decodeUtf8(parts.get("ppt/charts/_rels/chart1.xml.rels")!)).toContain(
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Worksheet1.xlsx"',
  )
  expect(decodeUtf8(parts.get("[Content_Types].xml")!)).toContain(
    '<Override PartName="/ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>',
  )
  const xml = decodeUtf8(parts.get("ppt/charts/chart1.xml")!)
  expect(xml).toContain('<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>')
  expect(xml).toContain("<c:tx><c:strRef><c:f>Sheet1!$C$1</c:f>")
  expect(xml).toContain("<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$5</c:f>")
  expect(xml).toContain("<c:val><c:numRef><c:f>Sheet1!$C$2:$C$5</c:f>")
  expect(chartWorkbookErrors(parts)).toEqual([])
  expect(workbookCells(parts.get(workbook)!)).toEqual([
    ["", "Series 1", "Series 2"],
    ["Q1", "4.1", "3.2"],
    ["Q2", "4.6", "3.5"],
    ["Q3", "5", "4.4"],
    ["Q4", "5.4", "4.9"],
  ])
})

it("rewrites the embedded workbook with the chart's new data and keeps its one part", async () => {
  const parts = new Map(await blank())
  addChart(parts, { part: slide, id: 9, ...box, chart: openingChart("bar") })
  const next = writeChart(parts, slide, "9", {
    kind: "pie",
    categories: ["North", "South & East"],
    series: [{ name: "Share", values: [60, 40] }],
  })
  expect([...next.keys()].filter((name) => name.startsWith("ppt/embeddings/"))).toEqual([workbook])
  expect(chartWorkbookErrors(next)).toEqual([])
  expect(workbookCells(next.get(workbook)!)).toEqual([
    ["", "Share"],
    ["North", "60"],
    ["South & East", "40"],
  ])
  expect(decodeUtf8(next.get("ppt/charts/_rels/chart1.xml.rels")!).match(/<Relationship /g)).toHaveLength(1)
})

it("reads a chart's value back from the file, so a chart made here opens again with its numbers and settings", async () => {
  const parts = new Map(await blank())
  const styled: ChartValue = {
    ...openingChart("bar"),
    title: "Revenue by quarter",
    labels: "#,##0.0",
    axis: false,
    gap: 50,
  }
  addChart(parts, { part: slide, id: 9, ...box, chart: styled })
  const value = chartXml.fields.value
  if (value.at !== "whole") throw new Error("chart value")
  expect(value.codec.read(parts, { slide: "256", part: slide, shape: "9" })).toBe(writeChartValue(styled))
  expect(value.codec.read(parts, { slide: "256", part: slide, shape: "2" })).toBeNull()
})

it("paints a consulting chart's title, labels, hidden value axis, no gridlines, gap, colours and legend", async () => {
  const parts = new Map(await blank())
  addChart(parts, {
    part: slide,
    id: 9,
    ...box,
    chart: {
      kind: "bar",
      categories: ["FY24", "FY25"],
      series: [
        { name: "Core", values: [41.25, 46.5], color: { rgb: "1F4E79" } },
        { name: "New", values: [3, 7] },
      ],
      title: "New products add growth",
      labels: "#,##0.0",
      axis: false,
      gridlines: false,
      gap: 40,
      legend: "top",
    },
  })
  const chart = painted(parts)
  expect(chart?.title?.text).toBe("New products add growth")
  expect(chart?.title?.look.bold).toBe(true)
  expect(chart?.series[0]?.labels.map((label) => label?.text)).toEqual(["41.3", "46.5"])
  expect(chart?.series[0]?.labels[0]?.position).toBe("outsideEnd")
  expect(chart?.valueAxis?.shown).toBe(false)
  expect(chart?.valueAxis?.gridlines).toBeNull()
  expect(chart?.gap).toBe(0.4)
  expect(chart?.series[0]?.points[0]?.fill).toMatchObject({ hex: "1F4E79" })
  expect(chart?.legend?.position).toBe("top")
})

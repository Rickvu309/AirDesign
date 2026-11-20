import { openingChart, type ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { chartValueOf } from "./chart-read.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { addChart, writeChart } from "./chart-write.js"
import { decodeUtf8 } from "./package-bytes.js"
import { partData, readContainer } from "./package-container.js"
import { paintReader, readPackage } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const slide = "ppt/slides/slide1.xml"
const box = { x: 914_400, y: 914_400, cx: 6_096_000, cy: 3_429_000 }
const chartPart = "ppt/charts/chart1.xml"

async function written(chart: ChartValue) {
  const read = await readPackage(
    process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`),
  )
  if (!read.ok) throw new Error("blank")
  const parts = new Map(read.parts)
  addChart(parts, { part: slide, id: 9, ...box, chart })
  return parts
}

function painted(parts: ReadonlyMap<string, Uint8Array>) {
  return paintReader(parts)
    .slide(slide)
    .elements.find((element) => element.chart !== undefined)?.chart
}

function labels(parts: ReadonlyMap<string, Uint8Array>) {
  const chart = painted(parts)
  return chart?.categories.map((_, at) =>
    (chart.series.map((series) => series.labels[at]?.text).filter((text) => text !== undefined) as string[]).join(" "),
  )
}

function sheet(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const bytes = parts.get("ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx")!
  const files = new Map(readContainer(bytes).map((record) => [record.name, decodeUtf8(partData(record)!)]))
  const strings = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(
    (found) => found[1] ?? "",
  )
  const cells = [
    ...(files.get("xl/worksheets/sheet1.xml") ?? "").matchAll(/<c r="([A-Z]+\d+)"( t="s")?><v>([^<]*)<\/v>/g),
  ]
  return cells.map(
    ([, at, shared, value]) => `${at ?? ""}=${shared === undefined ? (value ?? "") : (strings[Number(value)] ?? "")}`,
  )
}

it("draws a bridge as a stacked column on an invisible base, with signed changes and totals on the axis", async () => {
  const parts = await written(openingChart("waterfall"))
  const xml = decodeUtf8(parts.get(chartPart)!)
  expect(xml).toContain('<c:barDir val="col"/><c:grouping val="stacked"/>')
  expect(xml).toContain('<c:overlap val="100"/>')
  expect(xml.match(/<c:ser>/g)).toHaveLength(4)
  expect(xml).toMatch(/<c:ser><c:idx val="0"\/>.*?<c:v>Base<\/c:v>.*?<c:spPr><a:noFill\/><\/c:spPr>/)
  expect(xml).toContain('formatCode="&quot;+&quot;General;&quot;+&quot;General"')
  expect(xml).toContain('formatCode="&quot;-&quot;General;&quot;-&quot;General"')
  expect(xml).not.toContain('<c:dLblPos val="outEnd"/>')
  expect(sheet(parts)).toEqual([
    "B1=Base",
    "C1=Increase",
    "D1=Decrease",
    "E1=Revenue ($M)",
    "A2=FY24",
    "E2=100",
    "A3=Price",
    "B3=100",
    "C3=12",
    "A4=Volume",
    "B4=112",
    "C4=18",
    "A5=New markets",
    "B5=130",
    "C5=9",
    "A6=Churn",
    "B6=125",
    "D6=14",
    "A7=FY25",
    "E7=125",
  ])
  expect(chartWorkbookErrors(parts)).toEqual([])
  const chart = painted(parts)
  expect(chart?.kind).toBe("column")
  expect(chart?.grouping).toBe("stacked")
  expect(chart?.series[0]?.points.every((point) => point.fill === null)).toBe(true)
  expect(chart?.valueAxis?.shown).toBe(false)
  expect(chart?.valueAxis?.max).toBeGreaterThanOrEqual(139)
  expect(labels(parts)).toEqual(["100", "+12", "+18", "+9", "-14", "125"])
  expect(chart?.series[3]?.labels[0]?.look.color).toEqual({ hex: "FFFFFF", alpha: 1 })
  expect(chart?.series[1]?.labels[1]?.look.color).toEqual({ hex: "202020", alpha: 1 })
  expect(chart?.legend).toBeNull()
  expect(chartValueOf(parts.get(chartPart)!)).toEqual(openingChart("waterfall"))
})

it("labels a change that crosses zero with its whole size, and reads it back", async () => {
  const crossing: ChartValue = {
    kind: "waterfall",
    categories: ["Start", "Loss", "Recovery", "End"],
    series: [{ name: "EBIT ($M)", values: [10, -25, 30.3, 15.3] }],
    totals: [0, 3],
    labels: "General",
  }
  const parts = await written(crossing)
  expect(labels(parts)).toEqual(["10", "-25", "+30.3", "15.3"])
  const chart = painted(parts)
  expect(chart?.series[0]?.points[1]?.fill).not.toBeNull()
  expect(chart?.series[0]?.points[2]?.fill).not.toBeNull()
  expect(chartWorkbookErrors(parts)).toEqual([])
  expect(chartValueOf(parts.get(chartPart)!)).toEqual(crossing)
})

it("keeps each bar's own colour, writes a legend without the base, and rewrites the chart on any edit", async () => {
  const green = { rgb: "2E7D32" }
  const red = { rgb: "C0504D" }
  const opening = openingChart("waterfall")
  const coloured: ChartValue = {
    ...opening,
    legend: "bottom",
    series: opening.series.map((series) => ({
      ...series,
      colors: series.values.map((value, at) => (at === 0 || at === 5 ? { scheme: "tx2" } : value < 0 ? red : green)),
    })),
  }
  const parts = await written(coloured)
  const xml = decodeUtf8(parts.get(chartPart)!)
  expect(xml).toContain('<c:legendEntry><c:idx val="0"/><c:delete val="1"/></c:legendEntry>')
  expect(painted(parts)?.legend?.entries.map((entry) => entry.text)).toEqual(["Increase", "Decrease", "Revenue ($M)"])
  expect(chartValueOf(parts.get(chartPart)!)).toEqual(coloured)
  const edited: ChartValue = { ...opening, categories: [...opening.categories.slice(0, 5), "FY26"] }
  const next = writeChart(parts, slide, "9", edited)
  expect([...next.keys()].filter((name) => /^ppt\/(charts|embeddings)\//.test(name)).sort()).toEqual([
    "ppt/charts/_rels/chart1.xml.rels",
    "ppt/charts/chart1.xml",
    "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx",
  ])
  expect(chartValueOf(next.get(chartPart)!)).toEqual(edited)
  expect(chartWorkbookErrors(next)).toEqual([])
})

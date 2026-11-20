import type { ChartValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { chartValueOf } from "./chart-read.js"
import { chartWorkbookErrors, unzipped } from "./chart-workbook-check.js"
import { chartPartOf, writeChart } from "./chart-write.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readPackage, readShapes } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function deckChart(deck: string, shapeAt = 0) {
  const file = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${deck}`)
  const read = await readPackage(file)
  if (!read.ok) throw new Error(deck)
  const shape = readShapes(read.parts).filter((each) => each.contentKind === "chart")[shapeAt]
  if (shape === undefined) throw new Error("chart")
  const chartPart = chartPartOf(read.parts, shape.part, shape.shape)
  const chart = chartValueOf(read.parts.get(chartPart)!)
  if (chart === null) throw new Error("value")
  const edit = (value: ChartValue) => {
    const next = writeChart(read.parts, shape.part, shape.shape, value)
    const workbook = [...next.keys()].find((name) => name.endsWith(".xlsx") && next.get(name) !== read.parts.get(name))
    const book = workbook === undefined ? null : unzipped(next.get(workbook)!)
    const sheet = (name: string) => decodeUtf8(book?.get(name) ?? new Uint8Array())
    return {
      before: decodeUtf8(read.parts.get(chartPart)!),
      after: decodeUtf8(next.get(chartPart)!),
      read: chartValueOf(next.get(chartPart)!),
      next,
      sheet: () => sheet("xl/worksheets/sheet1.xml"),
      table: () => sheet("xl/tables/table1.xml"),
    }
  }
  return { chart, edit }
}

const count = (text: string, marker: string) => text.split(marker).length - 1
const deckMarkers = ["<a:latin", "<c16:uniqueId", "lumMod", "<c:majorGridlines>"]

it("adds a row to a PowerPoint column chart, its formulas, its workbook cells and table, keeping the deck's look", async () => {
  const { chart, edit } = await deckChart("office-chart.pptx")
  const grown: ChartValue = {
    ...chart,
    categories: [...chart.categories, "East"],
    series: chart.series.map((series, at) => ({ ...series, values: [...series.values, at === 0 ? 3.1 : 2.2] })),
  }
  const { before, after, read, next, sheet, table } = edit(grown)
  expect(read).toEqual(grown)
  for (const marker of deckMarkers) expect(count(after, marker)).toBe(count(before, marker))
  expect(after).toContain("<c:f>Sheet1!$A$2:$A$5</c:f>")
  expect(after).toContain("<c:f>Sheet1!$C$2:$C$5</c:f>")
  expect(after).toContain('<c:pt idx="3"><c:v>East</c:v></c:pt>')
  expect(chartWorkbookErrors(next)).toEqual([])
  expect(sheet()).toContain('<c r="B5" s="1"><v>3.1</v></c>')
  expect(sheet()).toContain('<dimension ref="A1:C5"/>')
  expect(table()).toContain('ref="A1:C5"')
  expect(table()).toContain('<autoFilter ref="A1:C5"/>')
})

it("removes a middle row and moves the rows below it up, in the chart and in the workbook", async () => {
  const { chart, edit } = await deckChart("office-chart.pptx")
  const kept = (_: unknown, at: number) => at !== 1
  const shrunk: ChartValue = {
    ...chart,
    categories: chart.categories.filter(kept),
    series: chart.series.map((series) => ({ ...series, values: series.values.filter(kept) })),
  }
  const { read, next, after, sheet, table } = edit(shrunk)
  expect(read).toEqual(shrunk)
  expect(after).toContain("<c:f>Sheet1!$A$2:$A$3</c:f>")
  expect(after).not.toContain('<c:pt idx="2">')
  expect(chartWorkbookErrors(next)).toEqual([])
  expect(sheet()).not.toContain('r="A4"')
  expect(table()).toContain('ref="A1:C3"')
})

it("adds a series that looks like its neighbours, with its own colour, column and table column", async () => {
  const { chart, edit } = await deckChart("office-chart.pptx")
  const grown: ChartValue = { ...chart, series: [...chart.series, { name: "2026", values: [5, 4.5, 3.9] }] }
  const { before, after, read, next, sheet, table } = edit(grown)
  expect(read).toEqual(grown)
  const added = /<c:ser><c:idx val="2"\/>.*?<\/c:ser>/u.exec(after)?.[0] ?? ""
  expect(added).toContain('<c:order val="2"/>')
  expect(added).toContain("<c:f>Sheet1!$D$1</c:f>")
  expect(added).toContain("<c:f>Sheet1!$D$2:$D$4</c:f>")
  expect(added).toContain('<a:solidFill><a:schemeClr val="accent3"/></a:solidFill><a:ln><a:noFill/></a:ln>')
  expect(added).not.toContain("c16:uniqueId")
  expect(count(after, "<c16:uniqueId")).toBe(count(before, "<c16:uniqueId"))
  expect(chartWorkbookErrors(next)).toEqual([])
  expect(sheet()).toContain('<c r="D2" s="1"><v>5</v></c>')
  expect(table()).toContain('ref="A1:D4"')
  expect(table()).toContain('<tableColumns count="4">')
  expect(table()).toContain('<tableColumn id="4" name="2026"/>')
})

it("removes the last series and its column from the workbook and table", async () => {
  const { chart, edit } = await deckChart("office-chart.pptx", 1)
  const shrunk: ChartValue = { ...chart, series: chart.series.slice(0, 1) }
  const { read, next, after, sheet, table } = edit(shrunk)
  expect(read).toEqual(shrunk)
  expect(after).not.toContain('<c:idx val="1"/>')
  expect(chartWorkbookErrors(next)).toEqual([])
  expect(sheet()).not.toContain('r="C2"')
  expect(table()).toContain('ref="A1:B4"')
  expect(table()).toContain('<tableColumns count="2">')
})

it("gives a new pie slice the next colour with the slices' own border, and keeps each slice's colour when one is removed", async () => {
  const { chart, edit } = await deckChart("census-updating-spm.pptx")
  const [series] = chart.series
  if (series === undefined) throw new Error("series")
  const grown: ChartValue = {
    ...chart,
    categories: [...chart.categories, "Moved away"],
    series: [{ ...series, values: [...series.values, 2] }],
  }
  const added = edit(grown)
  expect(added.read).toEqual(grown)
  expect(added.after).toContain(
    '<c:dPt><c:idx val="2"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:schemeClr val="accent3"/></a:solidFill><a:ln w="19050"><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></a:ln>',
  )
  expect(chartWorkbookErrors(added.next)).toEqual([])
  const first: ChartValue = {
    ...chart,
    categories: chart.categories.slice(1),
    series: [{ ...series, values: series.values.slice(1) }],
  }
  const removed = edit(first)
  expect(removed.read).toEqual(first)
  expect(removed.after).toContain(
    '<c:dPt><c:idx val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:schemeClr val="accent2"/>',
  )
  expect(removed.after).toContain('<c:dLbl><c:idx val="0"/>')
  expect(chartWorkbookErrors(removed.next)).toEqual([])
})

it("adds a line series with its neighbours' stroke width and cap, in its own colour", async () => {
  const { chart, edit } = await deckChart("office-chart.pptx", 1)
  const grown: ChartValue = { ...chart, series: [...chart.series, { name: "2026", values: [3, 3.6, 2.9] }] }
  const { read, after, next } = edit(grown)
  expect(read).toEqual(grown)
  const added = /<c:ser><c:idx val="2"\/>.*?<\/c:ser>/u.exec(after)?.[0] ?? ""
  expect(added).toContain(
    '<a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill><a:round/></a:ln>',
  )
  expect(added).toContain('<c:marker><c:symbol val="none"/></c:marker>')
  expect(added).toContain('<c:smooth val="0"/>')
  expect(chartWorkbookErrors(next)).toEqual([])
})

import { openingChart } from "@airdesign/document"
import { expect, it } from "vitest"
import { addChart } from "./chart-write.js"
import { chartWorkbookErrors } from "./chart-workbook-check.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { storedZip } from "./stored-zip.js"

const slide = "ppt/slides/slide1.xml"
const chart = "ppt/charts/chart1.xml"
const workbook = "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx"
const types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
const slideXml =
  '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>'

function charted(): Map<string, Uint8Array> {
  const parts = new Map([
    ["[Content_Types].xml", encodeUtf8(types)],
    [slide, encodeUtf8(slideXml)],
    ["ppt/slides/_rels/slide1.xml.rels", encodeUtf8('<Relationships xmlns="x"></Relationships>')],
  ])
  addChart(parts, { part: slide, id: 4, x: 0, y: 0, cx: 100, cy: 100, chart: openingChart("bar") })
  return parts
}

function edited(parts: Map<string, Uint8Array>, part: string, from: string, to: string) {
  parts.set(part, encodeUtf8(decodeUtf8(parts.get(part)!).replace(from, to)))
}

it("finds nothing wrong when every cached point matches its cell", () => {
  expect(chartWorkbookErrors(charted())).toEqual([])
})

it("names the cell whose value differs from the chart's cache", () => {
  const parts = charted()
  edited(parts, chart, "<c:v>4.6</c:v>", "<c:v>9.9</c:v>")
  edited(parts, chart, "<c:v>Q3</c:v>", "<c:v>Q7</c:v>")
  expect(chartWorkbookErrors(parts)).toEqual([
    "Chart workbook: /ppt/charts/chart1.xml Sheet1!$A$2:$A$5 cell A4 holds Q3, its cache Q7",
    "Chart workbook: /ppt/charts/chart1.xml Sheet1!$B$2:$B$5 cell B3 holds 4.6, its cache 9.9",
  ])
})

it("names a range whose length differs from the cache, a missing workbook and one that does not open", () => {
  const short = charted()
  edited(short, chart, "<c:f>Sheet1!$C$2:$C$5</c:f>", "<c:f>Sheet1!$C$2:$C$4</c:f>")
  expect(chartWorkbookErrors(short)).toEqual([
    "Chart workbook: /ppt/charts/chart1.xml Sheet1!$C$2:$C$4 spans 3 cells, its cache 4",
  ])
  const missing = charted()
  missing.delete(workbook)
  expect(chartWorkbookErrors(missing)).toEqual([`Chart workbook: /${chart} links /${workbook}, which is missing`])
  const broken = charted()
  broken.set(workbook, storedZip([["readme.txt", encodeUtf8("no workbook")]]))
  expect(chartWorkbookErrors(broken)).toEqual([`Chart workbook: /${workbook} does not open as a workbook`])
})

it("leaves a chart with literal values or no embedded workbook alone", () => {
  const parts = charted()
  edited(parts, chart, '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>', "")
  edited(parts, chart, "<c:v>4.6</c:v>", "<c:v>9.9</c:v>")
  expect(chartWorkbookErrors(parts)).toEqual([])
})

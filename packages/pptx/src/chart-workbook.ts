import type { ChartValue } from "@airdesign/document"
import { waterfallSeries } from "./chart-waterfall.js"
import { encodeUtf8 } from "./package-bytes.js"
import { xmlText } from "./shape-write.js"
import { storedZip } from "./stored-zip.js"

export const workbookContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export const workbookSheet = "Sheet1"

const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const officeRelationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const packageRelationships = "http://schemas.openxmlformats.org/package/2006/relationships"
const spreadsheetType = "application/vnd.openxmlformats-officedocument.spreadsheetml"
const headerRow = 1
const firstDataRow = 2

export function columnName(at: number): string {
  let rest = at + 1
  let name = ""
  while (rest > 0) {
    const digit = (rest - 1) % 26
    name = String.fromCharCode(65 + digit) + name
    rest = Math.floor((rest - 1) / 26)
  }
  return name
}

function cell(column: number, row: number): string {
  return `$${columnName(column)}$${String(row)}`
}

function span(column: number, count: number): string {
  const first = cell(column, firstDataRow)
  return count === 1 ? first : `${first}:${cell(column, firstDataRow + count - 1)}`
}

export type ChartTable = {
  readonly categories: readonly string[]
  readonly series: readonly { readonly name: string; readonly values: readonly (number | null)[] }[]
}

export function chartTable(chart: ChartValue): ChartTable {
  return chart.kind === "waterfall" ? { categories: chart.categories, series: waterfallSeries(chart) } : chart
}

export type ChartFormulas = {
  readonly categories: string
  readonly series: readonly { readonly name: string; readonly values: string }[]
}

export function chartFormulas(chart: ChartTable): ChartFormulas {
  const count = chart.categories.length
  return {
    categories: `${workbookSheet}!${span(0, count)}`,
    series: chart.series.map((_, at) => ({
      name: `${workbookSheet}!${cell(at + 1, headerRow)}`,
      values: `${workbookSheet}!${span(at + 1, count)}`,
    })),
  }
}

function sharedStrings(chart: ChartTable): ReadonlyMap<string, number> {
  const strings = new Map<string, number>()
  for (const text of [...chart.series.map((series) => series.name), ...chart.categories])
    if (!strings.has(text)) strings.set(text, strings.size)
  return strings
}

function textCell(reference: string, strings: ReadonlyMap<string, number>, text: string): string {
  return `<c r="${reference}" t="s"><v>${String(strings.get(text) ?? 0)}</v></c>`
}

function sheetXml(chart: ChartTable, strings: ReadonlyMap<string, number>): string {
  const header = chart.series
    .map((series, at) => textCell(`${columnName(at + 1)}${String(headerRow)}`, strings, series.name))
    .join("")
  const rows = chart.categories.map((category, point) => {
    const row = firstDataRow + point
    const values = chart.series
      .map((series, at) => {
        const value = series.values[point]
        return value === null ? "" : `<c r="${columnName(at + 1)}${String(row)}"><v>${String(value ?? 0)}</v></c>`
      })
      .join("")
    return `<row r="${String(row)}">${textCell(`A${String(row)}`, strings, category)}${values}</row>`
  })
  const last = `${columnName(chart.series.length)}${String(firstDataRow + chart.categories.length - 1)}`
  return `${declaration}<worksheet xmlns="${main}" xmlns:r="${officeRelationships}"><dimension ref="A1:${last}"/><sheetData><row r="${String(headerRow)}">${header}</row>${rows.join("")}</sheetData></worksheet>`
}

function stringsXml(chart: ChartTable, strings: ReadonlyMap<string, number>): string {
  const items = [...strings.keys()].map((text) => `<si><t xml:space="preserve">${xmlText(text)}</t></si>`).join("")
  const used = String(chart.series.length + chart.categories.length)
  return `${declaration}<sst xmlns="${main}" count="${used}" uniqueCount="${String(strings.size)}">${items}</sst>`
}

const stylesXml = `${declaration}<styleSheet xmlns="${main}"><fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const workbookXml = `${declaration}<workbook xmlns="${main}" xmlns:r="${officeRelationships}"><sheets><sheet name="${workbookSheet}" sheetId="1" r:id="rId1"/></sheets></workbook>`

function relationships(rows: readonly (readonly [string, string])[]): string {
  const items = rows
    .map(([type, target], at) => `<Relationship Id="rId${String(at + 1)}" Type="${type}" Target="${target}"/>`)
    .join("")
  return `${declaration}<Relationships xmlns="${packageRelationships}">${items}</Relationships>`
}

const contentTypesXml = `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${spreadsheetType}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${spreadsheetType}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${spreadsheetType}.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="${spreadsheetType}.sharedStrings+xml"/></Types>`

export function chartWorkbook(value: ChartValue): Uint8Array {
  const chart = chartTable(value)
  const strings = sharedStrings(chart)
  const files: [string, string][] = [
    ["[Content_Types].xml", contentTypesXml],
    ["_rels/.rels", relationships([[`${officeRelationships}/officeDocument`, "xl/workbook.xml"]])],
    ["xl/workbook.xml", workbookXml],
    [
      "xl/_rels/workbook.xml.rels",
      relationships([
        [`${officeRelationships}/worksheet`, "worksheets/sheet1.xml"],
        [`${officeRelationships}/styles`, "styles.xml"],
        [`${officeRelationships}/sharedStrings`, "sharedStrings.xml"],
      ]),
    ],
    ["xl/worksheets/sheet1.xml", sheetXml(chart, strings)],
    ["xl/styles.xml", stylesXml],
    ["xl/sharedStrings.xml", stringsXml(chart, strings)],
  ]
  return storedZip(files.map(([name, xml]) => [name, encodeUtf8(xml)]))
}

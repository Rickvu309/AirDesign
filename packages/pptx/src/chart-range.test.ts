import { describe, expect, it } from "vitest"
import { chartRangeFaults } from "./chart-range.js"
import { encodeUtf8, readParts, writeParts } from "./package-bytes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")

const sheetXml = (cells: readonly string[]) =>
  `<worksheet><sheetData><row>${cells.map((cell) => `<c r="${cell}"/>`).join("")}</row></sheetData></worksheet>`

const workbookXml = `<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`

const workbookRels = `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`

const chartRels = `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/book.xlsx"/></Relationships>`

const chartXml = (formulas: readonly string[]) =>
  `<c:chartSpace>${formulas
    .map(
      (formula) =>
        `<c:ser><c:val><c:numRef><c:f>${formula}</c:f><c:numCache><c:ptCount val="${formula.includes(":") ? "2" : "1"}"/></c:numCache></c:numRef></c:val></c:ser>`,
    )
    .join("")}</c:chartSpace>`

async function deck(formulas: readonly string[], cells: readonly string[]): Promise<Map<string, Uint8Array>> {
  const book = await writeParts(
    new Map([
      ["xl/workbook.xml", encodeUtf8(workbookXml)],
      ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
      ["xl/worksheets/sheet1.xml", encodeUtf8(sheetXml(cells))],
    ]),
  )
  return new Map([
    ["ppt/charts/chart1.xml", encodeUtf8(chartXml(formulas))],
    ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
    ["ppt/embeddings/book.xlsx", book],
  ])
}

describe("chartRangeFaults", () => {
  it("accepts a formula whose cells the workbook holds and whose cache matches", async () => {
    const parts = await deck(["Sheet1!$A$1:$B$1"], ["A1", "B1"])
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("rejects a formula that points outside the cells the workbook holds", async () => {
    const parts = await deck(["Sheet1!$A$1:$A$2"], ["A1"])
    expect(await chartRangeFaults(parts)).toEqual([
      "ppt/charts/chart1.xml formula Sheet1!$A$1:$A$2 points outside the workbook",
    ])
  })

  it("rejects a data-label formula on a column the sheet does not hold", async () => {
    const book = await writeParts(
      new Map([
        ["xl/workbook.xml", encodeUtf8(workbookXml)],
        ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
        ["xl/worksheets/sheet1.xml", encodeUtf8(sheetXml(["A1", "B1", "A2", "B2"]))],
      ]),
    )
    const chart = `<c:chartSpace><c:ser><c:val><c:numRef><c:f>Sheet1!$B$1:$B$2</c:f><c:numCache><c:ptCount val="2"/></c:numCache></c:numRef></c:val></c:ser><c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart"><c15:datalabelsRange><c15:f>Sheet1!$C$4:$C$6</c15:f></c15:datalabelsRange></c:ext></c:chartSpace>`
    const parts = new Map([
      ["ppt/charts/chart1.xml", encodeUtf8(chart)],
      ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
      ["ppt/embeddings/book.xlsx", book],
    ])
    expect(await chartRangeFaults(parts)).toEqual([
      "ppt/charts/chart1.xml formula Sheet1!$C$4:$C$6 points outside the workbook",
    ])
  })

  it("rejects a formula whose cached point count does not match the range", async () => {
    const book = await writeParts(
      new Map([
        ["xl/workbook.xml", encodeUtf8(workbookXml)],
        ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
        ["xl/worksheets/sheet1.xml", encodeUtf8(sheetXml(["A1", "A2", "A3"]))],
      ]),
    )
    const chart = `<c:chartSpace><c:ser><c:cat><c:strRef><c:f>Sheet1!$A$1:$A$3</c:f><c:strCache><c:ptCount val="1"/></c:strCache></c:strRef></c:cat></c:ser></c:chartSpace>`
    const parts = new Map([
      ["ppt/charts/chart1.xml", encodeUtf8(chart)],
      ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
      ["ppt/embeddings/book.xlsx", book],
    ])
    expect(await chartRangeFaults(parts)).toEqual([
      "ppt/charts/chart1.xml formula Sheet1!$A$1:$A$3 cached points do not match",
    ])
  })

  it("leaves a formula alone when the chart has no embedded workbook", async () => {
    const parts = new Map([["ppt/charts/chart1.xml", encodeUtf8(chartXml(["Sheet1!$AA$9:$AA$12"]))]])
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("accepts the chart formulas in census-updating-spm", async () => {
    const parts = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`))
    expect(await chartRangeFaults(parts)).toEqual([])
  })
})

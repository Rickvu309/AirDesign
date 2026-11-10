import { describe, expect, it } from "vitest"
import { chartRangeFaults } from "./chart-range.js"
import { encodeUtf8, readParts, writeParts } from "./package-bytes.js"
import { newDuplicateShapeIds } from "./shape-id.js"
import { newValidatorErrors } from "./validator-error.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
  getBuiltinModule(name: "node:module"): {
    createRequire(path: string): (id: string) => {
      judge: (
        pptx: {
          newValidatorErrors: typeof newValidatorErrors
          chartRangeFaults: typeof chartRangeFaults
          newDuplicateShapeIds: typeof newDuplicateShapeIds
        },
        before: { list: readonly string[]; ids: readonly []; parts: ReadonlyMap<string, Uint8Array> },
        after: { list: readonly string[]; ids: readonly []; parts: ReadonlyMap<string, Uint8Array> },
      ) => Promise<{ accepted: boolean }>
    }
  }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
const { createRequire } = process.getBuiltinModule("node:module")
const { judge } = createRequire(`${process.cwd()}/packages/pptx/package.json`)("../../scripts/judge.mjs")

const workbookRels = `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`

const chartRels = `<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/book.xlsx"/></Relationships>`

const cells = (refs: readonly string[]) =>
  `<sheetData><row>${refs.map((ref) => `<c r="${ref}"/>`).join("")}</row></sheetData>`

const chartXml = (formula: string) =>
  `<c:chartSpace><c:ser><c:val><c:numRef><c:f>${formula}</c:f></c:numRef></c:val></c:ser></c:chartSpace>`

async function deck(formula: string, sheetBody: string, sheetName = "Sheet1"): Promise<Map<string, Uint8Array>> {
  const book = await writeParts(
    new Map([
      [
        "xl/workbook.xml",
        encodeUtf8(`<workbook><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      ],
      ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
      ["xl/worksheets/sheet1.xml", encodeUtf8(`<worksheet>${sheetBody}</worksheet>`)],
    ]),
  )
  return new Map([
    ["ppt/charts/chart1.xml", encodeUtf8(chartXml(formula))],
    ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
    ["ppt/embeddings/book.xlsx", book],
  ])
}

async function accepted(before: Map<string, Uint8Array>, after: Map<string, Uint8Array>): Promise<boolean> {
  const judged = await judge(
    { newValidatorErrors, chartRangeFaults, newDuplicateShapeIds },
    { list: [], ids: [], parts: before },
    { list: [], ids: [], parts: after },
  )
  return judged.accepted
}

describe("chartRangeFaults", () => {
  it("accepts a formula whose rectangle holds a stored cell", async () => {
    const parts = await deck("Sheet1!$A$1:$B$1", cells(["A1", "B1"]))
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("reports nothing for a sparse range and accepts the extended edit", async () => {
    const before = await deck("Sheet1!$A$1:$A$3", cells(["A1", "A3"]))
    const after = await deck("Sheet1!$A$1:$A$4", cells(["A1", "A3", "A4"]))
    expect(await chartRangeFaults(before)).toEqual([])
    expect(await accepted(before, after)).toBe(true)
  })

  it("reports nothing for a merged blank and accepts the extended edit", async () => {
    const before = await deck(
      "Sheet1!$A$1:$A$2",
      `${cells(["A1"])}<mergeCells count="1"><mergeCell ref="A1:A2"/></mergeCells>`,
    )
    const after = await deck(
      "Sheet1!$A$1:$A$3",
      `${cells(["A1", "A3"])}<mergeCells count="1"><mergeCell ref="A1:A2"/></mergeCells>`,
    )
    expect(await chartRangeFaults(before)).toEqual([])
    expect(await accepted(before, after)).toBe(true)
  })

  it("reports nothing for a formatted-only blank and accepts the extended edit", async () => {
    const before = await deck("Sheet1!$A$1:$A$3", `<cols><col min="1" max="1" style="1"/></cols>${cells(["A1", "A3"])}`)
    const after = await deck(
      "Sheet1!$A$1:$A$4",
      `<cols><col min="1" max="1" style="1"/></cols>${cells(["A1", "A3", "A4"])}`,
    )
    expect(await chartRangeFaults(before)).toEqual([])
    expect(await accepted(before, after)).toBe(true)
  })

  it("reports nothing for a two-level category range", async () => {
    const chart = `<c:chartSpace><c:ser><c:cat><c:multiLvlStrRef><c:f>Sheet1!$A$1:$B$3</c:f><c:multiLvlStrCache><c:ptCount val="3"/></c:multiLvlStrCache></c:multiLvlStrRef></c:cat></c:ser></c:chartSpace>`
    const book = await writeParts(
      new Map([
        [
          "xl/workbook.xml",
          encodeUtf8(`<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
        ],
        ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
        [
          "xl/worksheets/sheet1.xml",
          encodeUtf8(`<worksheet>${cells(["A1", "B1", "A2", "B2", "A3", "B3"])}</worksheet>`),
        ],
      ]),
    )
    const parts = new Map([
      ["ppt/charts/chart1.xml", encodeUtf8(chart)],
      ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
      ["ppt/embeddings/book.xlsx", book],
    ])
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("skips an external workbook reference", async () => {
    const parts = await deck("[1]Other!$A$1:$A$3", cells(["A1"]))
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("skips a sheet name whose entity is still encoded", async () => {
    const parts = await deck("'A &amp; B'!$A$1", cells(["A1"]))
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("rejects a data-label formula on a column the sheet does not hold", async () => {
    const book = await writeParts(
      new Map([
        [
          "xl/workbook.xml",
          encodeUtf8(`<workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
        ],
        ["xl/_rels/workbook.xml.rels", encodeUtf8(workbookRels)],
        ["xl/worksheets/sheet1.xml", encodeUtf8(`<worksheet>${cells(["A1", "B1", "A2", "B2"])}</worksheet>`)],
      ]),
    )
    const chart = `<c:chartSpace><c:ser><c:val><c:numRef><c:f>Sheet1!$B$1:$B$2</c:f></c:numRef></c:val></c:ser><c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart"><c15:datalabelsRange><c15:f>Sheet1!$C$4:$C$6</c15:f></c15:datalabelsRange></c:ext></c:chartSpace>`
    const parts = new Map([
      ["ppt/charts/chart1.xml", encodeUtf8(chart)],
      ["ppt/charts/_rels/chart1.xml.rels", encodeUtf8(chartRels)],
      ["ppt/embeddings/book.xlsx", book],
    ])
    expect(await chartRangeFaults(parts)).toEqual([
      "ppt/charts/chart1.xml formula Sheet1!$C$4:$C$6 points outside the workbook",
    ])
  })

  it("rejects a range on a sheet the workbook does not have", async () => {
    const parts = await deck("Other!$A$1:$A$3", cells(["A1"]))
    expect(await chartRangeFaults(parts)).toEqual([
      "ppt/charts/chart1.xml formula Other!$A$1:$A$3 points outside the workbook",
    ])
  })

  it("leaves a formula alone when the chart has no embedded workbook", async () => {
    const parts = new Map([["ppt/charts/chart1.xml", encodeUtf8(chartXml("Sheet1!$AA$9:$AA$12"))]])
    expect(await chartRangeFaults(parts)).toEqual([])
  })

  it("accepts the chart formulas in census-updating-spm", async () => {
    const parts = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/census-updating-spm.pptx`))
    expect(await chartRangeFaults(parts)).toEqual([])
  })
})

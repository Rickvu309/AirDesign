import { describe, expect, it } from "vitest"
import { changedTable, type TableChange, type TableValue } from "@airdesign/document"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { newTableBreaks } from "./table-check.js"
import { readCells, readTable, writeTable } from "./table-write.js"

const part = "ppt/slides/slide1.xml"
const body = `<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>x</a:t></a:r></a:p></a:txBody>`
const cells = [
  `<a:tc>${body}<a:tcPr/></a:tc>`,
  `<a:tc>${body}<a:tcPr marL="0"><a:lnL w="9525"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:prstDash val="dash"/></a:lnL><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:tcPr></a:tc>`,
  `<a:tc>${body}</a:tc>`,
]
const frame = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table 7"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="300" cy="200"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="100"/><a:gridCol w="100"/><a:gridCol w="100"/></a:tblGrid><a:tr h="100">${cells.join("")}</a:tr><a:tr h="100">${cells.join("")}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`

function deck(): Map<string, Uint8Array> {
  return new Map([[part, encodeUtf8(`<p:sld><p:cSld><p:spTree>${frame}</p:spTree></p:cSld></p:sld>`)]])
}

function written(...changes: TableChange[]): string {
  const parts = deck()
  const value = changes.reduce<TableValue>(
    (table, change) => {
      const next = changedTable(table, change)
      if (next === null) throw new Error(change.change)
      return next
    },
    readTable(parts, part, "7")!,
  )
  const next = writeTable(parts, part, "7", value)
  expect(newTableBreaks(parts, next)).toEqual([])
  return decodeUtf8(next.get(part)!)
}

function cellsOf(xml: string): readonly string[] {
  return [...xml.matchAll(/<a:tc>.*?<\/a:tc>/g)].map((match) => match[0].slice(body.length + 6))
}

const accent = { solid: { scheme: "accent1" } } as const
const header = { rows: [0, 0], columns: [0, 2] } as const

describe("cell fills and borders", () => {
  it("writes a fill into each cell's properties, after its borders, and makes the properties when a cell has none", () => {
    const row = cellsOf(written({ change: "fill", cells: header, fill: accent }))
    expect(row[0]).toBe(`<a:tcPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:tcPr></a:tc>`)
    expect(row[1]).toBe(
      `<a:tcPr marL="0"><a:lnL w="9525"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:prstDash val="dash"/></a:lnL><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:tcPr></a:tc>`,
    )
    expect(row[2]).toBe(`<a:tcPr><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:tcPr></a:tc>`)
    expect(row.slice(3)).toEqual(cellsOf(decodeUtf8(deck().get(part)!)).slice(3))
  })

  it("writes nothing for a fill or border the cell already has, and the part as it is for a value with none", () => {
    const parts = deck()
    const value = readTable(parts, part, "7")!
    expect(writeTable(parts, part, "7", value).get(part)).toBe(parts.get(part))
    const same = changedTable(value, {
      change: "fill",
      cells: { rows: [0, 0], columns: [1, 1] },
      fill: { solid: { scheme: "accent2" } },
    })!
    expect(writeTable(parts, part, "7", same).get(part)).toBe(parts.get(part))
  })

  it("patches only the border fields it is given, in DrawingML order, and keeps the rest of the border", () => {
    const xml = written(
      { change: "border", cells: header, sides: "bottom", border: { width: 25400, fill: accent } },
      { change: "border", cells: { rows: [0, 0], columns: [1, 1] }, sides: "left", border: { width: 12700 } },
    )
    const [first, second] = cellsOf(xml)
    expect(first).toBe(
      `<a:tcPr><a:lnR w="12700"/><a:lnB w="25400"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:lnB></a:tcPr></a:tc>`,
    )
    expect(second).toBe(
      `<a:tcPr marL="0"><a:lnL w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill><a:prstDash val="dash"/></a:lnL><a:lnB w="25400"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:lnB><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:tcPr></a:tc>`,
    )
    expect(cellsOf(xml)[3]).toBe(
      `<a:tcPr><a:lnT w="25400"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:lnT></a:tcPr></a:tc>`,
    )
  })

  it("reads each cell's own fill and borders back from the file", () => {
    const parts = deck()
    const value = changedTable(readTable(parts, part, "7")!, {
      change: "border",
      cells: header,
      sides: "top",
      border: { dash: "sysDot" },
    })!
    const next = writeTable(parts, part, "7", value)
    const read = readCells(next, part, "7")
    expect(read[0]?.[1]).toEqual({
      fill: { solid: { scheme: "accent2" } },
      borders: {
        left: { width: 9525, fill: { solid: { rgb: "FF0000" } }, dash: "dash" },
        top: { dash: "sysDot" },
      },
    })
    expect(read[1]?.[0]).toEqual({ fill: null, borders: {} })
  })
})

describe("column widths and row heights", () => {
  const sizes = (xml: string, tag: string, name: string) =>
    [...xml.matchAll(new RegExp(`<${tag} ${name}="(\\d+)"`, "g"))].map((match) => Number(match[1]))

  it("shares the frame's width among the columns and its height among the rows, as the value weighs them", () => {
    const xml = written({ change: "widths", widths: [1, 1, 2] }, { change: "heights", heights: [1, 3] })
    expect(sizes(xml, "a:gridCol", "w")).toEqual([75, 75, 150])
    expect(sizes(xml, "a:tr", "h")).toEqual([50, 150])
    expect(xml).toContain('<a:ext cx="300" cy="200"/>')
  })

  it("keeps a new column's share beside its neighbour's", () => {
    const xml = written({ change: "widths", widths: [1, 1, 2] }, { change: "column", column: 2, place: "after" })
    expect(sizes(xml, "a:gridCol", "w")).toEqual([67, 66, 134, 133])
    expect(xml).toContain('<a:ext cx="400" cy="200"/>')
  })
})

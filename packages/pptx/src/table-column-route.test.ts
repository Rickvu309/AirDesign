import { changedTable, type TableValue } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyStructuralRoute } from "./structural-route.js"
import { newTableBreaks } from "./table-check.js"
import { readTable, writeTable } from "./table-write.js"

const part = "ppt/slides/slide1.xml"
const colId = (id: string) =>
  `<a:extLst><a:ext uri="{9D8B030D-6E8A-4147-A177-3AD203B41FA5}"><a16:colId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" val="${id}"/></a:ext></a:extLst>`
const cell = (text: string, fill = "") =>
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1800" b="1"/><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr marL="5">${fill}</a:tcPr></a:tc>`
const grid = `<a:tblGrid><a:gridCol w="100">${colId("10")}</a:gridCol><a:gridCol w="300">${colId("20")}</a:gridCol></a:tblGrid>`
const frame = (cells: string) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table 7"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="401" cy="300"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/>${grid}${cells}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
const plain = frame(
  `<a:tr h="100">${cell("A")}${cell("B", "<a:noFill/>")}</a:tr><a:tr h="200">${cell("C")}${cell("D", "<a:noFill/>")}</a:tr>`,
)

function deck(shapes = plain): Map<string, Uint8Array> {
  return new Map([[part, encodeUtf8(`<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`)]])
}

function xml(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get(part) ?? new Uint8Array())
}

function texts(parts: ReadonlyMap<string, Uint8Array>): string[][] {
  return readTable(parts, part, "7")!.rows.map((row) =>
    row.cells.map((each) => each.map((p) => p.runs.map((r) => r.text).join("")).join("|")),
  )
}

function changed(value: TableValue, ...changes: Parameters<typeof changedTable>[1][]): TableValue {
  return changes.reduce((table, change) => changedTable(table, change) ?? table, value)
}

describe("table column routes", () => {
  it("adds an empty column after a column that keeps its look and width, widens the frame, and removing it restores the part", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, { name: "tbl.addColumn", part, shape: "7", column: 2, place: "after" })
    const text = xml(added)
    expect(text).toContain('<a:ext cx="701" cy="300"/>')
    expect(text.match(/<a:gridCol w="300">/g)).toHaveLength(2)
    expect(text.match(/<a:tcPr marL="5"><a:noFill\/><\/a:tcPr>/g)).toHaveLength(4)
    expect(text).toContain('<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US" sz="1800" b="1"/></a:p>')
    const ids = (parts: ReadonlyMap<string, Uint8Array>) =>
      [...xml(parts).matchAll(/a16:colId [^>]*val="(\d+)"/g)].map((id) => id[1])
    expect(ids(added)).toEqual(["10", "20", "21"])
    const highest = deck(plain.replace('val="20"', 'val="4294967295"').replace('val="10"', 'val="0"'))
    const wrapped = applyStructuralRoute(highest, {
      name: "tbl.addColumn",
      part,
      shape: "7",
      column: 1,
      place: "before",
    })
    expect(ids(wrapped)).toEqual(["1", "0", "4294967295"])
    expect(texts(added)).toEqual([
      ["A", "B", ""],
      ["C", "D", ""],
    ])
    expect(newTableBreaks(parts, added)).toEqual([])
    const removed = applyStructuralRoute(added, { name: "tbl.removeColumn", part, shape: "7", column: 3 })
    expect(removed.get(part)).toEqual(parts.get(part))
  })

  it("adds a column before the first column and deletes a column with its width", () => {
    const parts = deck()
    const before = applyStructuralRoute(parts, { name: "tbl.addColumn", part, shape: "7", column: 1, place: "before" })
    expect(texts(before)).toEqual([
      ["", "A", "B"],
      ["", "C", "D"],
    ])
    expect(xml(before)).toContain('<a:ext cx="501" cy="300"/>')
    const removed = applyStructuralRoute(parts, { name: "tbl.removeColumn", part, shape: "7", column: 1 })
    expect(texts(removed)).toEqual([["B"], ["D"]])
    expect(xml(removed)).toContain('<a:ext cx="301" cy="300"/>')
    expect(newTableBreaks(parts, removed)).toEqual([])
  })

  it("refuses the last column, a column that is not there, and a merged table", () => {
    const one = applyStructuralRoute(deck(), { name: "tbl.removeColumn", part, shape: "7", column: 1 })
    expect(() => applyStructuralRoute(one, { name: "tbl.removeColumn", part, shape: "7", column: 1 })).toThrow()
    expect(() => applyStructuralRoute(deck(), { name: "tbl.removeColumn", part, shape: "7", column: 3 })).toThrow()
    expect(() =>
      applyStructuralRoute(deck(), { name: "tbl.addColumn", part, shape: "7", column: 0, place: "after" }),
    ).toThrow()
    const merged = deck(plain.replace("<a:tc>", '<a:tc gridSpan="2">'))
    expect(() =>
      applyStructuralRoute(merged, { name: "tbl.addColumn", part, shape: "7", column: 1, place: "after" }),
    ).toThrow(/tbl.merged/)
    expect(() => applyStructuralRoute(merged, { name: "tbl.removeColumn", part, shape: "7", column: 2 })).toThrow(
      /tbl.merged/,
    )
  })

  it("writes a table value with added and deleted columns and rows and keeps the frame on its grid and rows", () => {
    const parts = deck()
    const value = changed(
      readTable(parts, part, "7")!,
      { change: "column", column: 0, place: "before" },
      { change: "cell", row: 0, column: 0, text: "New" },
      { change: "remove-column", column: 1 },
      { change: "row", row: 1, place: "below" },
      { change: "column", column: 1, place: "after" },
      { change: "cell", row: 2, column: 2, text: "End" },
    )
    expect(value.columns).toEqual([-1, 1, -1])
    const written = writeTable(parts, part, "7", value)
    expect(texts(written)).toEqual([
      ["New", "B", ""],
      ["", "D", ""],
      ["", "", "End"],
    ])
    expect(xml(written)).toContain('<a:ext cx="701" cy="500"/>')
    expect(newTableBreaks(parts, written)).toEqual([])
    expect(writeTable(parts, part, "7", readTable(parts, part, "7")!).get(part)).toBe(parts.get(part))
  })

  it("names a frame no longer as wide as its grid and a span that runs past the grid", () => {
    const parts = deck()
    const wide = new Map([[part, encodeUtf8(xml(parts).replace('<a:gridCol w="100">', '<a:gridCol w="150">'))]])
    expect(newTableBreaks(parts, wide)).toEqual([{ part, shape: "7", reason: "width" }])
    const spans = new Map([
      [
        part,
        encodeUtf8(
          xml(parts).replace(
            `<a:tc>${cell("B", "<a:noFill/>").slice(6)}`,
            `<a:tc gridSpan="2">${cell("B", "<a:noFill/>").slice(6)}`,
          ),
        ),
      ],
    ])
    expect(newTableBreaks(parts, spans)).toEqual([{ part, shape: "7", reason: "cells" }])
  })
})

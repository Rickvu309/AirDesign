import { describe, expect, it } from "vitest"
import { changedTable, type TableValue } from "@airdesign/document"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyStructuralRoute } from "./structural-route.js"
import { newTableBreaks } from "./table-check.js"
import { readTable, writeTable } from "./table-write.js"
import { readParts } from "./package-container.js"
import { partTouch, touchMatches } from "./route-parts.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const part = "ppt/slides/slide1.xml"
const tree = `<p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp>`
const styled = `<a:tblStyleLst def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"><a:tblStyle styleId="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}" styleName="Medium Style 2 - Accent 1"/></a:tblStyleLst>`
const box = { x: 100, y: 200, cx: 3000, cy: 900, rows: 3, columns: 3 }
const cell = (text: string, size = "1800") =>
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${size}" b="1"/><a:t>${text}</a:t></a:r></a:p><a:p><a:r><a:t>more</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`
const imported = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="Table 7"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="200" cy="350"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="100"/><a:gridCol w="100"/></a:tblGrid><a:tr h="100">${cell("A")}${cell("B")}</a:tr><a:tr h="200">${cell("C", "1200")}${cell("D")}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`

const office = "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"
const stylesPart = "ppt/tableStyles.xml"

async function fixture(name: string): Promise<Map<string, Uint8Array>> {
  const file = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)
  return new Map(await readParts(file))
}

async function powerPointStyle(): Promise<string> {
  const styles = decodeUtf8((await fixture("nasa-1d-cnn.pptx")).get(stylesPart)!)
  return /<a:tblStyle styleId="\{5C22544A[^>]*>.*?<\/a:tblStyle>/s.exec(styles)![0]
}

function deck(shapes: string = tree, styles?: string): Map<string, Uint8Array> {
  const parts = new Map([[part, encodeUtf8(`<p:sld><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`)]])
  if (styles !== undefined) parts.set("ppt/tableStyles.xml", encodeUtf8(styles))
  return parts
}

function xml(parts: ReadonlyMap<string, Uint8Array>): string {
  return decodeUtf8(parts.get(part) ?? new Uint8Array())
}

function changed(value: TableValue, ...changes: Parameters<typeof changedTable>[1][]): TableValue {
  return changes.reduce((table, change) => {
    const next = changedTable(table, change)
    if (next === null) throw new Error(change.change)
    return next
  }, value)
}

describe("table routes", () => {
  it("adds a table at its box with the deck's own table style, rows and columns sharing the size", () => {
    const added = xml(applyStructuralRoute(deck(tree, styled), { name: "graphicFrame.addTable", part, id: 9, ...box }))
    expect(added).toContain('<p:cNvPr id="9" name="Table 9"/>')
    expect(added).toContain('<a:off x="100" y="200"/><a:ext cx="3000" cy="900"/>')
    expect(added).toContain('<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}')
    expect(added.match(/<a:gridCol w="1000"\/>/g)).toHaveLength(3)
    expect(added.match(/<a:tr h="300">/g)).toHaveLength(3)
    expect(added.match(/<a:tc>/g)).toHaveLength(9)
    expect(added).not.toContain("<a:lnL")
    expect(added.indexOf("<a:txBody")).toBeLessThan(added.indexOf("<a:tcPr"))
  })

  it("gives a deck with no table styles PowerPoint's own default style, as PowerPoint saves it", async () => {
    const before = await fixture("blank.pptx")
    const route = { name: "graphicFrame.addTable", part, ...box } as const
    const after = applyStructuralRoute(before, route)
    expect(xml(after)).toContain(`<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>${office}</a:tableStyleId>`)
    expect(xml(after)).not.toContain("<a:lnL")
    const styles = decodeUtf8(after.get(stylesPart)!)
    expect(styles).toBe(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${office}">${await powerPointStyle()}</a:tblStyleLst>`,
    )
    expect(decodeUtf8(after.get("[Content_Types].xml")!)).toContain(
      '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>',
    )
    expect(decodeUtf8(after.get("ppt/_rels/presentation.xml.rels")!)).toMatch(
      /Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/tableStyles" Target="tableStyles\.xml"/,
    )
    expect(touchMatches(before, after, partTouch(before, route))).toBe(true)
    const again = applyStructuralRoute(after, { ...route, x: 4000 })
    expect(again.get(stylesPart)).toBe(after.get(stylesPart))
    expect(touchMatches(after, again, partTouch(after, { ...route, x: 4000 }))).toBe(true)
  })

  it("adds the default style to a deck that names it but does not define it, and keeps a deck's own default", async () => {
    const named = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}"/>`
    const before = await fixture("blank.pptx")
    before.set(stylesPart, encodeUtf8(named))
    const route = { name: "graphicFrame.addTable", part, ...box } as const
    const after = applyStructuralRoute(before, route)
    expect(decodeUtf8(after.get(stylesPart)!)).toBe(named.replace("/>", `>${await powerPointStyle()}</a:tblStyleLst>`))
    expect(xml(after)).toContain(`<a:tableStyleId>${office}</a:tableStyleId>`)
    expect(touchMatches(before, after, partTouch(before, route))).toBe(true)
    const own = await fixture("nasa-1d-cnn.pptx")
    const slide = [...own.keys()].find((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))!
    const kept = applyStructuralRoute(own, { ...route, part: slide })
    expect(kept.get(stylesPart)).toBe(own.get(stylesPart))
    expect(touchMatches(own, kept, partTouch(own, { ...route, part: slide }))).toBe(true)
  })

  it("refuses a taken id or a box too small", () => {
    expect(() =>
      applyStructuralRoute(deck(tree, styled), { name: "graphicFrame.addTable", part, id: 2, ...box }),
    ).toThrow()
    expect(() =>
      applyStructuralRoute(deck(tree, styled), { name: "graphicFrame.addTable", part, ...box, cy: 2 }),
    ).toThrow()
  })

  it("adds an empty row that keeps the row's look, grows the frame by its height, and removing it restores the part", () => {
    const parts = deck(imported)
    const added = applyStructuralRoute(parts, { name: "tbl.addRow", part, row: 2 })
    const text = xml(added)
    expect(text).toContain('<a:ext cx="200" cy="550"/>')
    expect(text.match(/<a:tr h="200">/g)).toHaveLength(2)
    expect(text).toContain('<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="en-US" sz="1200" b="1"/></a:p>')
    expect(
      readTable(added, part, "7")?.rows.map((row) => row.cells.map((each) => each.flatMap((p) => p.runs))),
    ).toEqual([
      [
        [
          { from: 0, text: "A" },
          { from: 0, text: "more" },
        ],
        [
          { from: 0, text: "B" },
          { from: 0, text: "more" },
        ],
      ],
      [
        [
          { from: 0, text: "C" },
          { from: 0, text: "more" },
        ],
        [
          { from: 0, text: "D" },
          { from: 0, text: "more" },
        ],
      ],
      [[], []],
    ])
    expect(newTableBreaks(parts, added)).toEqual([])
    const removed = applyStructuralRoute(added, { name: "tbl.removeRow", part, row: 3 })
    expect(removed.get(part)).toEqual(parts.get(part))
  })

  it("writes a table value through the row routes and the cell text, and writes nothing for the table as it is", () => {
    const parts = deck(imported)
    const value = readTable(parts, part, "7")!
    expect(writeTable(parts, part, "7", value).get(part)).toBe(parts.get(part))
    const edited = changed(
      value,
      { change: "row", row: 0, place: "above" },
      { change: "cell", row: 0, column: 1, text: "Top" },
      { change: "remove-row", row: 1 },
      { change: "row", row: 1, place: "below" },
      { change: "cell", row: 2, column: 0, text: "End" },
      { change: "cell", row: 1, column: 0, text: "See" },
    )
    const written = writeTable(parts, part, "7", edited)
    const table = readTable(written, part, "7")!
    expect(
      table.rows.map((row) => row.cells.map((each) => each.map((p) => p.runs.map((r) => r.text).join("")).join("|"))),
    ).toEqual([
      ["", "Top"],
      ["See", "D|more"],
      ["End", ""],
    ])
    const text = xml(written)
    expect(text).toContain('<a:ext cx="200" cy="550"/>')
    expect(text.match(/<a:tr h="100">/g)).toHaveLength(1)
    expect(text.match(/<a:tr h="200">/g)).toHaveLength(2)
    expect(text).toContain('<a:rPr lang="en-US" sz="1200" b="1"/><a:t>See</a:t>')
    expect(newTableBreaks(parts, written)).toEqual([])
  })

  it("adds a row above the first row when the first rows are new", () => {
    const parts = deck(imported)
    const value = changed(
      readTable(parts, part, "7")!,
      { change: "row", row: 0, place: "above" },
      { change: "cell", row: 0, column: 0, text: "New" },
    )
    const text = xml(writeTable(parts, part, "7", value))
    expect(text.indexOf(">New<")).toBeLessThan(text.indexOf(">A<"))
    expect(text.indexOf(">A<")).toBeLessThan(text.indexOf(">C<"))
  })

  it("reads no table value from a merged table and refuses to write one", () => {
    const merged = imported.replace("<a:tc>", '<a:tc gridSpan="2">')
    expect(readTable(deck(merged), part, "7")).toBeNull()
    const value = readTable(deck(imported), part, "7")!
    expect(() => writeTable(deck(merged), part, "7", value)).toThrow(/tbl.merged/)
  })

  it("names a row whose cells miss a grid column and a frame whose height no longer matches its rows", () => {
    const parts = deck(imported)
    const short = new Map([[part, encodeUtf8(xml(parts).replace(`${cell("D")}</a:tr>`, "</a:tr>"))]])
    expect(newTableBreaks(parts, short)).toEqual([{ part, shape: "7", reason: "cells" }])
    const tall = new Map([[part, encodeUtf8(xml(parts).replace('<a:tr h="100">', '<a:tr h="150">'))]])
    expect(newTableBreaks(parts, tall)).toEqual([{ part, shape: "7", reason: "height" }])
    const fresh = applyStructuralRoute(deck(tree, styled), { name: "graphicFrame.addTable", part, ...box })
    expect(newTableBreaks(deck(tree, styled), fresh)).toEqual([])
  })
})

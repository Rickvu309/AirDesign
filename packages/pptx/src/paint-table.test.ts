import { expect, it } from "vitest"
import { paintReader, readParts, readShapes } from "./index.js"
import { encodeUtf8 } from "./package-bytes.js"
import { applyStructuralRoute } from "./structural-route.js"
import { readTable, writeTable } from "./table-write.js"
import { changedTable } from "@airdesign/document"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const slide = "ppt/slides/slide1.xml"
const cell = (text: string, properties = "", attributes = "", run = "") =>
  `<a:tc ${attributes}><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:spcAft><a:spcPts val="200"/></a:spcAft><a:buChar char="•"/></a:pPr><a:r><a:rPr sz="1200" ${run}/><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr ${properties}/></a:tc>`
const frame = (graphic: string) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2"/></p:nvGraphicFramePr><p:xfrm><a:off x="100" y="200"/><a:ext cx="3000000" cy="1500000"/></p:xfrm><a:graphic><a:graphicData>${graphic}</a:graphicData></a:graphic></p:graphicFrame>`
const table = (properties = 'firstRow="1" bandRow="1"') =>
  `<a:tbl><a:tblPr ${properties}><a:tableStyleId>style</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="2000000"/></a:tblGrid><a:tr h="400000">${cell("Header", 'marL="123" marT="456" anchor="ctr"', 'gridSpan="2"')}${cell("", "", 'hMerge="1"')}</a:tr><a:tr h="500000">${cell("Merged", "", 'rowSpan="2"')}${cell("Body", "", "", 'b="0"')}</a:tr><a:tr h="600000">${cell("", "", 'vMerge="1"')}${cell("Last")}</a:tr></a:tbl>`
const fill = (color: string) => `<a:fill><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:fill>`
const style = `<a:tblStyleLst def="style"><a:tblStyle styleId="style"><a:wholeTbl><a:tcTxStyle><a:srgbClr val="112233"/></a:tcTxStyle><a:tcStyle>${fill("EEEEEE")}<a:tcBdr><a:insideH><a:ln w="12700"><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:ln></a:insideH></a:tcBdr></a:tcStyle></a:wholeTbl><a:band1H><a:tcStyle>${fill("DDDDDD")}</a:tcStyle></a:band1H><a:band2H><a:tcStyle>${fill("CCCCCC")}</a:tcStyle></a:band2H><a:firstRow><a:tcTxStyle b="on"><a:srgbClr val="FFFFFF"/></a:tcTxStyle><a:tcStyle>${fill("445566")}</a:tcStyle></a:firstRow></a:tblStyle></a:tblStyleLst>`
const parts = (graphic = table()) =>
  new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${frame(graphic)}</p:spTree></p:cSld></p:sld>`)],
    ["ppt/tableStyles.xml", encodeUtf8(style)],
  ])
const painted = (graphic = table()) => paintReader(parts(graphic)).slide(slide).elements[0]

it("preserves explicit cell margins, including zero and signed coordinates, and supplies unstated defaults", () => {
  const source = table().replace('marL="123" marT="456" anchor="ctr"', 'marL="-123" marR="0" marT="456" marB="789"')
  const rows = painted(source)?.table?.rows
  expect(rows?.[0]?.cells[0]?.text?.insets).toEqual({ left: -123, right: 0, top: 456, bottom: 789 })
  expect(rows?.[1]?.cells[1]?.text?.insets).toEqual({ left: 91440, right: 91440, top: 45720, bottom: 45720 })
})

it("reads cell text with the shape text reader, dimensions, margins, anchor and merge continuations", () => {
  const row = painted()
  expect(row?.box).toMatchObject({ x: 100, y: 200, width: 3000000, height: 1500000 })
  expect(row?.table?.columns).toEqual([1000000, 2000000])
  expect(row?.table?.rows.map((each) => each.height)).toEqual([400000, 500000, 600000])
  const cells = row?.table?.rows.flatMap((each) => each.cells)
  expect(cells?.[0]).toMatchObject({ gridSpan: 2, rowSpan: 1, hMerge: false, vMerge: false })
  expect(cells?.[1]?.hMerge).toBe(true)
  expect(cells?.[2]?.rowSpan).toBe(2)
  expect(cells?.[4]?.vMerge).toBe(true)
  expect(cells?.[0]?.text).toMatchObject({
    anchor: "middle",
    insets: { left: 123, top: 456, right: 91440, bottom: 45720 },
    paragraphs: [{ spaceAfter: { points: 2 }, bullet: { char: "•" }, runs: [{ text: "Header", size: 12 }] }],
  })
})

it("inherits whole table, first row and alternating row fills and text without overriding local styles", () => {
  const rows = painted()?.table?.rows
  expect(rows?.[0]?.cells[0]).toMatchObject({
    fill: { type: "solid", color: { hex: "445566" } },
    text: { paragraphs: [{ runs: [{ color: { hex: "FFFFFF" }, bold: true }] }] },
  })
  expect(rows?.[1]?.cells[1]).toMatchObject({
    fill: { type: "solid", color: { hex: "DDDDDD" } },
    borders: { top: { width: 12700, fill: { color: { hex: "112233" } } } },
    text: { paragraphs: [{ runs: [{ color: { hex: "112233" }, bold: false }] }] },
  })
  expect(rows?.[2]?.cells[1]?.fill).toMatchObject({ color: { hex: "CCCCCC" } })
  const local = table()
    .replace(
      '<a:tcPr marL="123" marT="456" anchor="ctr"/>',
      '<a:tcPr><a:noFill/><a:lnB w="25400"><a:noFill/></a:lnB></a:tcPr>',
    )
    .replace(
      '<a:rPr sz="1200" />',
      '<a:rPr sz="1200" b="0"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr>',
    )
  expect(painted(local)?.table?.rows[0]?.cells[0]).toMatchObject({
    fill: { type: "none" },
    borders: { bottom: { width: 25400, fill: { type: "none" } } },
    text: { paragraphs: [{ runs: [{ color: { hex: "FF0000" }, bold: false }] }] },
  })
})

it("never treats a chart or SmartArt graphic as a table", () => {
  expect(painted("<c:chart/>")?.table ?? null).toBeNull()
  expect(painted("<dgm:relIds/>")?.table ?? null).toBeNull()
})

it("reads a cell picture fill through the slide's existing picture reader", () => {
  const source = parts(
    table().replace(
      '<a:tcPr marL="123" marT="456" anchor="ctr"/>',
      '<a:tcPr><a:blipFill><a:blip r:embed="cellPicture"/><a:stretch><a:fillRect/></a:stretch></a:blipFill></a:tcPr>',
    ),
  )
  source.set(
    "ppt/slides/_rels/slide1.xml.rels",
    encodeUtf8(
      '<Relationships><Relationship Id="cellPicture" Type="r/image" Target="../media/cell.png"/></Relationships>',
    ),
  )
  source.set("[Content_Types].xml", encodeUtf8('<Types><Default Extension="png" ContentType="image/png"/></Types>'))
  source.set("ppt/media/cell.png", new Uint8Array())
  expect(paintReader(source).slide(slide).elements[0]?.table?.rows[0]?.cells[0]?.fill).toMatchObject({
    type: "picture",
    part: "ppt/media/cell.png",
    contentType: "image/png",
  })
})

it("does not apply a body band to the header when its style states no fill", () => {
  const source = parts()
  source.set("ppt/tableStyles.xml", encodeUtf8(style.replace(fill("445566"), "")))
  expect(paintReader(source).slide(slide).elements[0]?.table?.rows[0]?.cells[0]?.fill).toMatchObject({
    color: { hex: "EEEEEE" },
  })
})

it("honors disabled style flags and does not guess an absent style's colors", () => {
  expect(painted(table('firstRow="0" bandRow="false"'))?.table?.rows[0]?.cells[0]?.fill).toMatchObject({
    color: { hex: "EEEEEE" },
  })
  const missing = parts()
  missing.delete("ppt/tableStyles.xml")
  expect(paintReader(missing).slide(slide).elements[0]?.table?.rows[0]?.cells[0]?.fill).toBeNull()
  expect(painted(table().replace(">style<", ">missing<"))?.table?.rows[0]?.cells[0]?.fill).toBeNull()
  const unresolved = table().replace(
    '<a:tcPr marL="123" marT="456" anchor="ctr"/>',
    '<a:tcPr><a:solidFill><a:schemeClr val="missing"/></a:solidFill></a:tcPr>',
  )
  expect(painted(unresolved)?.table?.rows[0]?.cells[0]?.fill).toBeNull()
  expect(
    painted(table().replace("<a:tableStyleId>style</a:tableStyleId>", ""))?.table?.rows[0]?.cells[0]?.fill,
  ).toBeNull()
})

it("reads the styled merged corpus table without writing any package part and locks its shape", async () => {
  const file = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/corpus/nasa-cots-electronics.pptx`)
  const original = await readParts(file)
  const before = [...original].map(([name, bytes]) => [name, [...bytes]])
  const part = "ppt/slides/slide11.xml"
  const row = paintReader(original)
    .slide(part)
    .elements.find((each) => each.table !== undefined)
  expect(row?.table?.columns).toEqual([1141467, 2098619, 1911553, 1911553, 1166409])
  expect(row?.table?.rows[0]?.cells[0]?.rowSpan).toBe(3)
  expect(row?.table?.rows[0]?.cells[1]?.gridSpan).toBe(4)
  expect(row?.table?.rows[0]?.cells[1]?.text?.paragraphs[0]?.runs[0]?.text).toBe("Objectives: ")
  expect(row?.table?.rows[0]?.cells[0]?.fill).toMatchObject({ type: "solid", color: { hex: "4F81BD" } })
  expect(readShapes(original).find((each) => each.part === part && each.shape === row?.shape)?.locked).toBe(true)
  expect([...original].map(([name, bytes]) => [name, [...bytes]])).toEqual(before)
})

it("paints a new table on a blank deck with a theme header whose text is light and bold, and banded rows", async () => {
  const file = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const blank = await readParts(file)
  const box = { x: 100, y: 200, cx: 3000000, cy: 900000, rows: 3, columns: 2 }
  const added = applyStructuralRoute(blank, { name: "graphicFrame.addTable", part: slide, id: 9, ...box })
  const typed = changedTable(readTable(added, slide, "9")!, { change: "cell", row: 0, column: 0, text: "Region" })
  const body = changedTable(typed!, { change: "cell", row: 1, column: 0, text: "North" })
  const rows = paintReader(writeTable(added, slide, "9", body!))
    .slide(slide)
    .elements.find((each) => each.table !== undefined)?.table?.rows
  expect(rows?.[0]?.cells[0]?.fill).toMatchObject({ type: "solid", color: { hex: "2D6FCD" } })
  expect(rows?.[0]?.cells[0]?.text?.paragraphs[0]?.runs[0]).toMatchObject({
    text: "Region",
    bold: true,
    color: { hex: "FFFFFF" },
  })
  expect(rows?.[1]?.cells[0]?.fill).toMatchObject({ type: "solid", color: { hex: "CDD4EC" } })
  expect(rows?.[1]?.cells[0]?.text?.paragraphs[0]?.runs[0]).toMatchObject({
    text: "North",
    color: { hex: "202020" },
  })
})

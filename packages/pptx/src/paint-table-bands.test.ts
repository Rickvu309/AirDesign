import { expect, it } from "vitest"
import { paintReader } from "./index.js"
import { encodeUtf8 } from "./package-bytes.js"

const slide = "ppt/slides/slide1.xml"
const cell = (text: string) =>
  `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1200"/><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`
const row = (name: string) => `<a:tr h="300000">${cell(`${name}1`)}${cell(`${name}2`)}${cell(`${name}3`)}</a:tr>`
const table = (flags: string) =>
  `<a:tbl><a:tblPr ${flags}><a:tableStyleId>style</a:tableStyleId></a:tblPr><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="1000000"/><a:gridCol w="1000000"/></a:tblGrid>${row("a")}${row("b")}${row("c")}${row("d")}</a:tbl>`
const frame = (graphic: string) =>
  `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2400000"/></p:xfrm><a:graphic><a:graphicData>${graphic}</a:graphicData></a:graphic></p:graphicFrame>`
const part = (kind: string, color: string, text = "") =>
  `<a:${kind}>${text}<a:tcStyle><a:fill><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:fill></a:tcStyle></a:${kind}>`
const style =
  `<a:tblStyleLst def="style"><a:tblStyle styleId="style">` +
  part("wholeTbl", "EEEEEE") +
  part("band1H", "D1D1D1") +
  part("band2H", "D2D2D2") +
  part("band1V", "A1A1A1") +
  part("band2V", "A2A2A2") +
  part("lastCol", "0000CC") +
  part("firstCol", "4472C4", `<a:tcTxStyle b="on"><a:srgbClr val="FFFFFF"/></a:tcTxStyle>`) +
  part("lastRow", "00CC00") +
  part("firstRow", "CC0000") +
  part("seCell", "333333") +
  part("nwCell", "111111") +
  `</a:tblStyle></a:tblStyleLst>`
const fills = (flags: string) => {
  const parts = new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${frame(table(flags))}</p:spTree></p:cSld></p:sld>`)],
    ["ppt/tableStyles.xml", encodeUtf8(style)],
  ])
  const rows = paintReader(parts).slide(slide).elements[0]?.table?.rows ?? []
  return rows.map((each) => each.cells.map((one) => (one.fill?.type === "solid" ? one.fill.color.hex : null)))
}

it("paints the first column's style over the row bands, with its text style", () => {
  expect(fills('firstCol="1" bandRow="1"')).toEqual([
    ["4472C4", "D1D1D1", "D1D1D1"],
    ["4472C4", "D2D2D2", "D2D2D2"],
    ["4472C4", "D1D1D1", "D1D1D1"],
    ["4472C4", "D2D2D2", "D2D2D2"],
  ])
  const parts = new Map([
    [slide, encodeUtf8(`<p:sld><p:cSld><p:spTree>${frame(table('firstCol="1"'))}</p:spTree></p:cSld></p:sld>`)],
    ["ppt/tableStyles.xml", encodeUtf8(style)],
  ])
  const first = paintReader(parts).slide(slide).elements[0]?.table?.rows[1]?.cells[0]?.text?.paragraphs[0]?.runs[0]
  expect([first?.color, first?.bold]).toEqual([{ hex: "FFFFFF", alpha: 1 }, true])
})

it("paints the last row and last column, and column bands that skip the first column", () => {
  expect(fills('lastRow="1" lastCol="1"')).toEqual([
    ["EEEEEE", "EEEEEE", "0000CC"],
    ["EEEEEE", "EEEEEE", "0000CC"],
    ["EEEEEE", "EEEEEE", "0000CC"],
    ["00CC00", "00CC00", "333333"],
  ])
  expect(fills('firstCol="1" bandCol="1"')[1]).toEqual(["4472C4", "A1A1A1", "A2A2A2"])
  expect(fills('bandCol="1"')[1]).toEqual(["A1A1A1", "A2A2A2", "A1A1A1"])
})

it("paints the top left corner's own style where the first row and first column meet", () => {
  expect(fills('firstRow="1" firstCol="1"')[0]).toEqual(["111111", "CC0000", "CC0000"])
  expect(fills('firstRow="1" firstCol="1"')[1]?.[0]).toBe("4472C4")
})

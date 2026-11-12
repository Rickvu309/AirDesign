import { elementId } from "@airdesign/document"
import { paintReader } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { slideCanvases } from "./canvas-slide"

const css = (hex: string): string => `#${hex}`

it("maps table cells through the same text, color and line conversion and keeps what the deck lets a person edit", () => {
  const part = "ppt/slides/slide1.xml"
  const xml = `<p:sld><p:cSld><p:spTree><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="500000"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="1000000"/></a:tblGrid><a:tr h="500000"><a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="1200"><a:solidFill><a:prstClr val="white"/></a:solidFill></a:rPr><a:t>Cell</a:t></a:r></a:p></a:txBody><a:tcPr marL="123" anchor="ctr"><a:lnL w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill><a:prstDash val="dash"/></a:lnL><a:solidFill><a:prstClr val="blue"/></a:solidFill></a:tcPr></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`
  const reader = paintReader(new Map([[part, Uint8Array.from(xml, (each) => each.charCodeAt(0))]]))
  const source = {
    part,
    shapes: new Map([["2", { id: elementId("256.2"), kind: "chart" as const, editable: true, movable: true }]]),
  }
  const element = slideCanvases(reader, [source])(0)?.elements[0]
  expect(element?.editable).toBe(true)
  expect(element?.movable).toBe(true)
  const cell = element?.table?.rows[0]?.cells[0]
  expect(cell?.fill).toBe(css("0000FF"))
  expect(cell?.borders.left).toEqual({ color: css("000000"), width: 12700, dash: [4, 3] })
  expect(cell?.text).toMatchObject({
    anchor: "middle",
    insets: { left: 123 },
    paragraphs: [{ runs: [{ text: "Cell", size: 152400, color: css("FFFFFF") }] }],
  })
})

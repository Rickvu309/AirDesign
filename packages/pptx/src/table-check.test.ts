import { expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { newTableBreaks } from "./table-check.js"

function slide(frameHeight: number, words = ""): Uint8Array {
  return encodeUtf8(
    `<p:sld><p:cSld><p:spTree>${words}<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table"/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="${String(frameHeight)}"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="100"/></a:tblGrid><a:tr h="40"><a:tc/></a:tr><a:tr h="40"><a:tc/></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>`,
  )
}

it("does not blame a copied slide for a table gap its source already had", () => {
  const before = new Map([["ppt/slides/slide1.xml", slide(95)]])
  const after = new Map([...before, ["ppt/slides/slide2.xml", slide(95)]])
  expect(newTableBreaks(before, after)).toEqual([])
})

it("names a new slide whose table frame does not match its rows", () => {
  const before = new Map([["ppt/slides/slide1.xml", slide(80)]])
  const after = new Map([...before, ["ppt/slides/slide2.xml", slide(95)]])
  expect(newTableBreaks(before, after)).toEqual([{ part: "ppt/slides/slide2.xml", shape: "4", reason: "height" }])
})

it("does not blame a copy a person then edited for a table gap its source already had", () => {
  const before = new Map([["ppt/slides/slide1.xml", slide(95)]])
  const after = new Map([...before, ["ppt/slides/slide2.xml", slide(95, "<p:sp/>")]])
  const copies = new Map([["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]])
  expect(newTableBreaks(before, after, copies)).toEqual([])
})

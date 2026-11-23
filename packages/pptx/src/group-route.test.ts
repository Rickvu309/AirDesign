import { describe, expect, it } from "vitest"
import { indexPackage } from "./index.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const part = "ppt/slides/slide1.xml"

const shape = (id: number, x: number, y: number, cx: number, cy: number, fill = "") =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr></p:sp>`
const fileGroup =
  `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm rot="5400000" flipH="1"><a:off x="1000000" y="1000000"/><a:ext cx="400000" cy="200000"/><a:chOff x="0" y="0"/><a:chExt cx="200000" cy="100000"/></a:xfrm><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:grpSpPr>` +
  `${shape(11, 0, 0, 100000, 100000)}${shape(12, 100000, 0, 100000, 100000, "<a:grpFill/>")}<p:extLst/></p:grpSp>`
const body = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(3, 100000, 100000, 200000, 100000)}${shape(4, 50000, 50000, 10000, 10000)}${shape(5, 400000, 300000, 100000, 100000)}${fileGroup}</p:spTree></p:cSld></p:sld>`

function packaged() {
  return new Map<string, Uint8Array>([
    [
      "ppt/presentation.xml",
      xml('<p:presentation><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>'),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      xml(
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
      ),
    ],
    [part, xml(body)],
  ])
}

const parts = packaged()
const { elements: read } = indexPackage(parts)

describe("group export", () => {
  it("indexes a group's child frame and each child's group", () => {
    const tree = read.filter((element) => element.kind === "group" || element.grouped)
    expect(tree.map(({ node, frame, group }) => ({ node, frame, group }))).toEqual([
      { node: "258.10", frame: { x: 0, y: 0, cx: 200000, cy: 100000 }, group: undefined },
      { node: "258.11", frame: undefined, group: "258.10" },
      { node: "258.12", frame: undefined, group: "258.10" },
    ])
  })
})

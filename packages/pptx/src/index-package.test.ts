import { expect, it } from "vitest"
import { elementId, writeTextValue } from "@airdesign/document"
import { indexPackage } from "./index.js"

const xml = (value: string) => Uint8Array.from(value, (letter) => letter.charCodeAt(0))
const parts = new Map([
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
  [
    "ppt/slides/slide1.xml",
    xml(
      '<p:sld><p:cSld><p:spTree><p:grpSp><p:nvGrpSpPr><p:cNvPr id="2"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="3"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/><a:ext cx="3" cy="4"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp></p:grpSp><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl/></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld></p:sld>',
    ),
  ],
])

it("indexes stable slide ids, group children, table kinds, text floors, and opening boxes", () => {
  const index = indexPackage(parts)
  expect(index.slides).toEqual([{ id: "258", position: 0, free: 5, animated: [] }])
  expect(index.elements).toEqual([
    { node: elementId("258.2"), kind: "group", value: null, box: { x: 10, y: 20, cx: 30, cy: 40 }, grouped: false },
    {
      node: elementId("258.3"),
      kind: "shape",
      value: writeTextValue([{ from: 0, runs: [{ from: 0, text: "Title" }] }]),
      box: { x: 1, y: 2, cx: 3, cy: 4 },
      grouped: true,
    },
    { node: elementId("258.4"), kind: "table", value: null, box: null, grouped: false },
  ])
  expect(indexPackage(new Map([...parts].reverse()))).toEqual(index)
})

it("records the slide size, the first free shape id and the shapes an animation names", () => {
  const sized = new Map(parts)
  sized.set(
    "ppt/presentation.xml",
    xml(
      '<p:presentation><p:sldSz cx="12192000" cy="6858000"/><p:sldIdLst><p:sldId id="258" r:id="rId1"/></p:sldIdLst></p:presentation>',
    ),
  )
  sized.set(
    "ppt/slides/slide1.xml",
    xml(
      '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2"/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="9"/></p:nvSpPr></p:sp></p:spTree></p:cSld><p:timing><p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p:spTgt spid="9"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing></p:sld>',
    ),
  )
  expect(indexPackage(sized).slides).toEqual([
    { id: "258", position: 0, size: { width: 12192000, height: 6858000 }, free: 10, animated: ["9"] },
  ])
})

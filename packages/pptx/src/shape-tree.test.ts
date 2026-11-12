import { expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { paintReader } from "./paint-reader.js"
import { readShapes } from "./read-shapes.js"
import { encodeUtf8 } from "./package-bytes.js"
import { isShapeTag, owns, paintKind, shapeById } from "./shape-tree.js"

it("finds the nearest shape and keeps group children out of their parent's owned content", () => {
  const { elements } = markupDocument(
    encodeUtf8(
      `<p:spTree><p:grpSp><p:nvGrpSpPr><p:cNvPr id="1"/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2"/></p:nvSpPr><p:txBody><a:t>child</a:t></p:txBody></p:sp></p:grpSp></p:spTree>`,
    ),
  )
  const group = shapeById(elements, "1")
  const child = shapeById(elements, "2")
  const text = elements.find((element) => element.kind === "a:t")
  expect(group.kind).toBe("p:grpSp")
  expect(child.kind).toBe("p:sp")
  expect(text).toBeDefined()
  expect(owns(elements, text?.index ?? -1, group)).toBe(false)
  expect(owns(elements, text?.index ?? -1, child)).toBe(true)
  expect(owns(elements, -1, child)).toBe(false)
  expect(() => shapeById(elements, "missing")).toThrow("shape")
})

it("recognizes only shape tags and maps them to document kinds", () => {
  expect(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"].filter(isShapeTag).map(paintKind)).toEqual([
    "shape",
    "picture",
    "chart",
    "connector",
    "group",
  ])
  for (const tag of ["p:spTree", "p:spPr", "toString", "__proto__"]) expect(isShapeTag(tag)).toBe(false)
})

it("scans all markup for readShapes but only the shape tree for painting", () => {
  const shape = (id: string) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}"/></p:nvSpPr><p:spPr/></p:sp>`
  const parts = new Map([
    [
      "ppt/presentation.xml",
      encodeUtf8(
        '<p:presentation><p:sldSz cx="100" cy="100"/><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
      ),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      encodeUtf8(
        '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
      ),
    ],
    [
      "ppt/slides/slide1.xml",
      encodeUtf8(
        `<p:sld><p:cSld><p:spTree>${shape("2")}</p:spTree></p:cSld><p:extLst>${shape("3")}</p:extLst></p:sld>`,
      ),
    ],
  ])
  expect(readShapes(parts).map((row) => row.shape)).toEqual(["2", "3"])
  expect(
    paintReader(parts)
      .slide("ppt/slides/slide1.xml")
      .elements.map((row) => row.shape),
  ).toEqual(["2"])
})

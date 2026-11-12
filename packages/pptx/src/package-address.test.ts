import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportElements } from "./element-export.js"
import { partOf, presentationPart, presentationRels, relsOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintReader } from "./paint-reader.js"
import { readShapes, readSlides } from "./read-shapes.js"
import { partTouch } from "./route-parts.js"
import { applyStructuralRoute } from "./structural-route.js"

const slidePart = "ppt/slides/slide1.xml"
const slideRels = "ppt/slides/_rels/slide1.xml.rels"
const text = (value: string) => encodeUtf8(value)

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`
const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`

function dottedDeck(target: string): Map<string, Uint8Array> {
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${target}"/></Relationships>`
  return new Map([
    [slidePart, text(slide)],
    [slideRels, text("<Relationships/>")],
    ["ppt/presentation.xml", text(presentation)],
    ["ppt/_rels/presentation.xml.rels", text(rels)],
    ["[Content_Types].xml", text(types)],
  ])
}

describe("package address", () => {
  it("resolves a dot segment against the source part", () => {
    expect(partOf(presentationPart, "./slides/slide1.xml")).toBe(slidePart)
    expect(partOf(presentationPart, "slides/../slides/slide1.xml")).toBe(slidePart)
    expect(partOf(presentationPart, "/ppt/slides/slide1.xml")).toBe(slidePart)
    expect(presentationRels).toBe(relsOf(presentationPart))
    expect(relsOf(slidePart)).toBe(slideRels)
  })
})

describe("a slide target with a dot segment", () => {
  it.each(["./slides/slide1.xml", "slides/../slides/slide1.xml"])(
    "names the same part the paint reader opens for %s",
    (target) => {
      const parts = dottedDeck(target)
      const painted = paintReader(parts)
        .slide(slidePart)
        .elements.map((element) => element.shape)
      expect(painted).toContain("2")
      expect(readSlides(parts)).toEqual([{ slide: "256", part: slidePart }])
      expect(readShapes(parts).map((row) => row.part)).toEqual([slidePart])
      const written = exportElements(parts, [{ id: elementId("256.2"), name: "text", text: "Next" }])
      expect(written.parts.get(slidePart)).not.toEqual(parts.get(slidePart))
      expect(partTouch(parts, { name: "sldIdLst.remove", slide: "256" }).removed).toEqual([slidePart, slideRels])
      const removed = applyStructuralRoute(parts, { name: "sldIdLst.remove", slide: "256" })
      expect(removed.has(slidePart)).toBe(false)
      expect(removed.has(slideRels)).toBe(false)
    },
  )
})

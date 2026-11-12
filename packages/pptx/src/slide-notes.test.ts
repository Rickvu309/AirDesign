import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyStructuralRoute } from "./structural-route.js"

const text = (value: string) => encodeUtf8(value)
const notes = "ppt/notesSlides/notesSlide1.xml"

function deck(): Map<string, Uint8Array> {
  return new Map([
    [
      "ppt/slides/slide1.xml",
      text(`<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr></p:spTree></p:cSld></p:sld>`),
    ],
    [
      "ppt/slides/_rels/slide1.xml.rels",
      text(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
      ),
    ],
    [
      notes,
      text(
        `<p:notes><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Speak</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`,
      ),
    ],
    [
      "ppt/presentation.xml",
      text(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      text(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`,
      ),
    ],
    [
      "[Content_Types].xml",
      text(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/></Types>`,
      ),
    ],
  ])
}

describe("speaker notes on a slide route", () => {
  it.fails("gives a cloned slide its own notes part", () => {
    const cloned = applyStructuralRoute(deck(), { name: "sldIdLst.clone", slide: "256" })
    const rels = cloned.get("ppt/slides/_rels/slide2.xml.rels")
    if (rels === undefined) throw new Error("rels")
    expect(decodeUtf8(rels)).not.toContain("notesSlide1.xml")
  })

  it.fails("drops the notes part when its slide is removed", () => {
    const removed = applyStructuralRoute(deck(), { name: "sldIdLst.remove", slide: "256" })
    expect(removed.has(notes)).toBe(false)
  })
})

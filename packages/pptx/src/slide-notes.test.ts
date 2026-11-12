import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { removedSlideTouch } from "./slide-touch.js"
import { applyStructuralRoute } from "./structural-route.js"

const text = (value: string) => encodeUtf8(value)
const notes = "ppt/notesSlides/notesSlide1.xml"
const notesRels = "ppt/notesSlides/_rels/notesSlide1.xml.rels"
const relType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const notesType = "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"
const notesXml = `<p:notes><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Speak</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`

function slideRels(target: string): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relType}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${relType}/notesSlide" Target="${target}"/></Relationships>`
}

function notesRelsXml(slide: string): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${relType}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="${relType}/slide" Target="../slides/${slide}"/></Relationships>`
}

function deck(): Map<string, Uint8Array> {
  return new Map([
    [
      "ppt/slides/slide1.xml",
      text(`<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr></p:spTree></p:cSld></p:sld>`),
    ],
    ["ppt/slides/_rels/slide1.xml.rels", text(slideRels("../notesSlides/notesSlide1.xml"))],
    [notes, text(notesXml)],
    [notesRels, text(notesRelsXml("slide1.xml"))],
    ["ppt/notesMasters/notesMaster1.xml", text(`<p:notesMaster/>`)],
    [
      "ppt/presentation.xml",
      text(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`),
    ],
    [
      "ppt/_rels/presentation.xml.rels",
      text(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="${relType}/slide" Target="slides/slide1.xml"/></Relationships>`,
      ),
    ],
    [
      "[Content_Types].xml",
      text(
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="${notesType}"/></Types>`,
      ),
    ],
  ])
}

function xml(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return decodeUtf8(bytes)
}

describe("speaker notes on a slide route", () => {
  it("gives a cloned slide its own notes part", () => {
    const parts = deck()
    const cloned = applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "256" })
    expect(xml(cloned, "ppt/slides/_rels/slide2.xml.rels")).toBe(slideRels("../notesSlides/notesSlide2.xml"))
    expect(cloned.get("ppt/notesSlides/notesSlide2.xml")).toBe(parts.get(notes))
    expect(xml(cloned, "ppt/notesSlides/_rels/notesSlide2.xml.rels")).toBe(notesRelsXml("slide2.xml"))
    expect(xml(cloned, "[Content_Types].xml")).toContain(
      `<Override PartName="/ppt/notesSlides/notesSlide2.xml" ContentType="${notesType}"/>`,
    )
    expect(cloned.get(notes)).toBe(parts.get(notes))
    expect(cloned.get(notesRels)).toBe(parts.get(notesRels))
    expect(cloned.get("ppt/slides/_rels/slide1.xml.rels")).toBe(parts.get("ppt/slides/_rels/slide1.xml.rels"))
  })

  it("removes the clone's notes with the clone and restores the package", () => {
    const parts = deck()
    const cloned = applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "256" })
    const back = applyStructuralRoute(cloned, { name: "sldIdLst.remove", slide: "257" })
    expect([...back.keys()].sort()).toEqual([...parts.keys()].sort())
    for (const [name, bytes] of parts) expect(back.get(name)).toEqual(bytes)
  })

  it("drops the notes part when its slide is removed", () => {
    const parts = deck()
    const removed = applyStructuralRoute(parts, { name: "sldIdLst.remove", slide: "256" })
    expect(removed.has(notes)).toBe(false)
    expect(removed.has(notesRels)).toBe(false)
    expect(xml(removed, "[Content_Types].xml")).not.toContain("notesSlide1.xml")
    expect(removed.get("ppt/notesMasters/notesMaster1.xml")).toBe(parts.get("ppt/notesMasters/notesMaster1.xml"))
    expect(removedSlideTouch(parts, "ppt/slides/slide1.xml").removed).toEqual([
      "ppt/slides/slide1.xml",
      "ppt/slides/_rels/slide1.xml.rels",
      notes,
      notesRels,
    ])
  })

  it("keeps a notes part another slide still uses", () => {
    const parts = deck()
    parts.set("ppt/slides/slide2.xml", parts.get("ppt/slides/slide1.xml") ?? text(""))
    parts.set("ppt/slides/_rels/slide2.xml.rels", text(slideRels("/ppt/notesSlides/notesSlide1.xml")))
    const removed = applyStructuralRoute(parts, { name: "sldIdLst.remove", slide: "256" })
    expect(removed.get(notes)).toBe(parts.get(notes))
    expect(removed.get(notesRels)).toBe(parts.get(notesRels))
    expect(xml(removed, "[Content_Types].xml")).toContain("notesSlide1.xml")
  })
})

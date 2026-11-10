import { describe, expect, it } from "vitest"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { shapeById } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"

function text(value: string): Uint8Array {
  return encodeUtf8(value)
}

function xml(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return decodeUtf8(bytes)
}

const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="B"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Two</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const pictureSlide = `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>Shape</a:t></a:r></a:p></p:txBody></p:sp><p:pic><p:nvPicPr><p:cNvPr id="3" name="P"/></p:nvPicPr><p:spPr><a:xfrm><a:off x="9" y="8"/></a:xfrm></p:spPr></p:pic></p:spTree>`
const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const orderedSlides = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
const slideRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`
const table = `<p:sld><a:tbl><a:tr h="1"><a:tc><a:txBody><a:p><a:r><a:t>A</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr h="1"><a:tc><a:txBody><a:p><a:r><a:t>B</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></p:sld>`
const twoTables = `<p:sld><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="A"/></p:nvGraphicFramePr><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr></a:tbl></p:graphicFrame><p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="B"/></p:nvGraphicFramePr><a:tbl><a:tr h="1"><a:tc><a:t>B</a:t></a:tc></a:tr></a:tbl></p:graphicFrame></p:sld>`

function deck(slideXml: string = slide, presentationXml: string = presentation): Map<string, Uint8Array> {
  return new Map([
    ["ppt/slides/slide1.xml", text(slideXml)],
    ["ppt/slides/_rels/slide1.xml.rels", text(slideRels)],
    ["ppt/presentation.xml", text(presentationXml)],
    ["ppt/_rels/presentation.xml.rels", text(rels)],
    ["[Content_Types].xml", text(types)],
    ["ppt/media/keep.bin", Uint8Array.from([1, 0, 255])],
  ])
}

function elementBytes(bytes: Uint8Array, kind: string, id: string): Uint8Array {
  const elements = markupDocument(bytes).elements
  const direct = elements.find((element) => element.kind === kind && element.id === id)
  const found = direct ?? shapeById(elements, id)
  if (found.kind !== kind) throw new Error(kind)
  return bytes.slice(found.start, found.end)
}

function frameMarks(bytes: Uint8Array): { id: string | null; name: string | null }[] {
  const elements = markupDocument(bytes).elements
  return elements
    .filter((element) => element.kind === "p:graphicFrame")
    .map((frame) => {
      const mark = elements.find((element) => element.kind === "p:cNvPr" && inside(elements, element, frame))
      const name = mark?.attributes.find((item) => item.name === "name")?.value ?? null
      return { id: mark?.id ?? null, name }
    })
}

function inside(elements: readonly MarkupElement[], child: MarkupElement, ancestor: MarkupElement): boolean {
  let parent = child.parent
  while (parent >= 0) {
    if (parent === ancestor.index) return true
    const next = elements[parent]
    if (next === undefined) return false
    parent = next.parent
  }
  return false
}

describe("applyStructuralRoute", () => {
  it("reorders a shape and the inverse returns the original part", () => {
    const parts = deck()
    const media = parts.get("ppt/media/keep.bin")
    const moved = applyStructuralRoute(parts, {
      name: "spTree.order",
      part: "ppt/slides/slide1.xml",
      shape: "3",
      before: "2",
    })
    const movedXml = xml(moved, "ppt/slides/slide1.xml")
    expect(movedXml.indexOf('id="3"')).toBeLessThan(movedXml.indexOf('id="2"'))
    expect(movedXml).toContain(">One<")
    expect(movedXml).toContain(">Two<")
    expect(moved.get("ppt/media/keep.bin")).toBe(media)
    const back = applyStructuralRoute(moved, {
      name: "spTree.order",
      part: "ppt/slides/slide1.xml",
      shape: "2",
      before: "3",
    })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
  })

  it("moves a picture and leaves the shape bytes", () => {
    const parts = deck(pictureSlide)
    const before = parts.get("ppt/slides/slide1.xml")
    if (before === undefined) throw new Error("part")
    const picture = elementBytes(before, "p:pic", "3")
    const shape = elementBytes(before, "p:sp", "2")
    const moved = applyStructuralRoute(parts, {
      name: "spTree.order",
      part: "ppt/slides/slide1.xml",
      shape: "3",
      before: "2",
    })
    const after = moved.get("ppt/slides/slide1.xml")
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(elementBytes(after, "p:pic", "3")).toEqual(picture)
    expect(elementBytes(after, "p:sp", "2")).toEqual(shape)
    const afterElements = markupDocument(after).elements
    const pictureElement = shapeById(afterElements, "3")
    const shapeElement = shapeById(afterElements, "2")
    if (pictureElement.kind !== "p:pic" || shapeElement.kind !== "p:sp") throw new Error("shape")
    expect(pictureElement.start).toBeLessThan(shapeElement.start)
    const removed = applyStructuralRoute(parts, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "3" })
    const removedBytes = removed.get("ppt/slides/slide1.xml")
    if (removedBytes === undefined) throw new Error("part")
    expect(markupDocument(removedBytes).wellFormed).toBe(true)
    expect(elementBytes(removedBytes, "p:sp", "2")).toEqual(shape)
    expect(markupDocument(removedBytes).elements.some((element) => element.kind === "p:pic")).toBe(false)
  })

  it("clones a shape and remove of the new id restores the part", () => {
    const parts = deck()
    const cloned = applyStructuralRoute(parts, { name: "spTree.clone", part: "ppt/slides/slide1.xml", shape: "2" })
    const clonedXml = xml(cloned, "ppt/slides/slide1.xml")
    expect(clonedXml).toContain('<p:cNvPr id="4"')
    expect(clonedXml).toContain('<p:cNvPr id="2"')
    const back = applyStructuralRoute(cloned, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "4" })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
    expect(back.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
  })

  it("adds a text shape through spTree.add and remove restores the part", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, {
      name: "spTree.add",
      part: "ppt/slides/slide1.xml",
      text: "New",
      x: 0,
      y: 0,
      cx: 1,
      cy: 1,
    })
    expect(xml(added, "ppt/slides/slide1.xml")).toContain("<a:t>New</a:t>")
    const back = applyStructuralRoute(added, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "4" })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
  })

  it("rejects a group id, a fractional emu, and a missing part", () => {
    const parts = deck()
    expect(() =>
      applyStructuralRoute(parts, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "1" }),
    ).toThrow(/shape/)
    expect(() =>
      applyStructuralRoute(parts, {
        name: "spTree.add",
        part: "ppt/slides/slide1.xml",
        text: "New",
        x: 1.5,
        y: 0,
        cx: 1,
        cy: 1,
      }),
    ).toThrow(/emu/)
    expect(() =>
      applyStructuralRoute(parts, { name: "spTree.clone", part: "ppt/slides/missing.xml", shape: "2" }),
    ).toThrow(/part/)
    expect(() => applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "9" })).toThrow(/slide/)
  })

  it("clones a slide as the same bytes and remove restores the package parts", () => {
    const parts = deck()
    const slideBytes = parts.get("ppt/slides/slide1.xml")
    const relBytes = parts.get("ppt/slides/_rels/slide1.xml.rels")
    const cloned = applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "256" })
    expect(cloned.get("ppt/slides/slide1.xml")).toBe(slideBytes)
    expect(cloned.get("ppt/slides/slide2.xml")).toBe(slideBytes)
    expect(cloned.get("ppt/slides/_rels/slide2.xml.rels")).toBe(relBytes)
    expect(xml(cloned, "ppt/presentation.xml")).toContain('<p:sldId id="257" r:id="rId3"/>')
    expect(cloned.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
    const back = applyStructuralRoute(cloned, { name: "sldIdLst.remove", slide: "257" })
    expect(back.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
    expect(back.get("ppt/_rels/presentation.xml.rels")).toEqual(parts.get("ppt/_rels/presentation.xml.rels"))
    expect(back.get("[Content_Types].xml")).toEqual(parts.get("[Content_Types].xml"))
    expect(back.get("ppt/slides/slide2.xml")).toBeUndefined()
    expect(back.get("ppt/slides/_rels/slide2.xml.rels")).toBeUndefined()
  })

  it("adds a blank slide after the named slide and remove restores the package parts", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, { name: "sldIdLst.add", after: "256" })
    const addedSlide = xml(added, "ppt/slides/slide2.xml")
    expect(addedSlide).toContain('name=""')
    expect(addedSlide).not.toContain("One")
    expect(added.get("ppt/slides/_rels/slide2.xml.rels")).toEqual(parts.get("ppt/slides/_rels/slide1.xml.rels"))
    const back = applyStructuralRoute(added, { name: "sldIdLst.remove", slide: "257" })
    expect(back.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
    expect(back.get("ppt/_rels/presentation.xml.rels")).toEqual(parts.get("ppt/_rels/presentation.xml.rels"))
    expect(back.get("[Content_Types].xml")).toEqual(parts.get("[Content_Types].xml"))
  })

  it("reorders slides and the second move restores the presentation", () => {
    const parts = deck(slide, orderedSlides)
    const before = parts.get("ppt/presentation.xml")
    if (before === undefined) throw new Error("part")
    const later = elementBytes(before, "p:sldId", "257")
    const earlier = elementBytes(before, "p:sldId", "256")
    const moved = applyStructuralRoute(parts, { name: "sldIdLst.order", slide: "257", before: "256" })
    const movedBytes = moved.get("ppt/presentation.xml")
    if (movedBytes === undefined) throw new Error("part")
    expect(elementBytes(movedBytes, "p:sldId", "257")).toEqual(later)
    expect(elementBytes(movedBytes, "p:sldId", "256")).toEqual(earlier)
    expect(moved.get("ppt/slides/slide1.xml")).toBe(parts.get("ppt/slides/slide1.xml"))
    const back = applyStructuralRoute(moved, { name: "sldIdLst.order", slide: "256", before: "257" })
    expect(back.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
  })

  it("removes a slide part and leaves the other bytes", () => {
    const parts = deck()
    const removed = applyStructuralRoute(parts, { name: "sldIdLst.remove", slide: "256" })
    expect(removed.get("ppt/slides/slide1.xml")).toBeUndefined()
    expect(removed.get("ppt/slides/_rels/slide1.xml.rels")).toBeUndefined()
    expect(xml(removed, "ppt/presentation.xml")).not.toContain('id="256"')
    expect(xml(removed, "ppt/_rels/presentation.xml.rels")).not.toContain("slide1.xml")
    expect(xml(removed, "[Content_Types].xml")).not.toContain("slide1.xml")
    expect(removed.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
  })

  it("adds a section and remove restores the presentation", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, { name: "sectionLst.add", title: 'A & "B"' })
    const addedXml = xml(added, "ppt/presentation.xml")
    expect(addedXml).toContain('name="A &amp; &quot;B&quot;"')
    expect(addedXml).toContain("<p:sectionLst><p:section ")
    const back = applyStructuralRoute(added, { name: "sectionLst.remove", section: "1" })
    expect(back.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
    expect(back.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
  })

  it("reorders sections and the second move restores the presentation", () => {
    const parts = deck()
    const first = applyStructuralRoute(parts, { name: "sectionLst.add", title: "One" })
    const second = applyStructuralRoute(first, { name: "sectionLst.add", title: "Two" })
    const moved = applyStructuralRoute(second, { name: "sectionLst.order", section: "2", before: "1" })
    const movedXml = xml(moved, "ppt/presentation.xml")
    expect(movedXml.indexOf('name="Two"')).toBeLessThan(movedXml.indexOf('name="One"'))
    const back = applyStructuralRoute(moved, { name: "sectionLst.order", section: "1", before: "2" })
    expect(back.get("ppt/presentation.xml")).toEqual(second.get("ppt/presentation.xml"))
  })

  it("adds a table frame and remove restores the slide", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, { name: "graphicFrame.addTable", part: "ppt/slides/slide1.xml" })
    const addedXml = xml(added, "ppt/slides/slide1.xml")
    expect(addedXml).toContain('<p:cNvPr id="4" name="Table 4"/>')
    expect(addedXml).toContain(">One<")
    const back = applyStructuralRoute(added, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "4" })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
  })

  it("copies a table row and the inverse order restores the part", () => {
    const parts = deck(table)
    const added = applyStructuralRoute(parts, { name: "tbl.addRow", part: "ppt/slides/slide1.xml", row: 1 })
    expect(xml(added, "ppt/slides/slide1.xml").match(/<a:tr /g)?.length).toBe(3)
    const removed = applyStructuralRoute(added, { name: "tbl.removeRow", part: "ppt/slides/slide1.xml", row: 2 })
    expect(removed.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
    const moved = applyStructuralRoute(parts, {
      name: "tbl.orderRow",
      part: "ppt/slides/slide1.xml",
      row: 2,
      before: 1,
    })
    const movedXml = xml(moved, "ppt/slides/slide1.xml")
    expect(movedXml.indexOf(">B<")).toBeLessThan(movedXml.indexOf(">A<"))
    const back = applyStructuralRoute(moved, { name: "tbl.orderRow", part: "ppt/slides/slide1.xml", row: 2, before: 1 })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
  })

  it("moves the second table row and leaves both frames", () => {
    const parts = deck(twoTables)
    const before = parts.get("ppt/slides/slide1.xml")
    if (before === undefined) throw new Error("part")
    const first = elementBytes(before, "p:graphicFrame", "2")
    const second = elementBytes(before, "p:graphicFrame", "3")
    const moved = applyStructuralRoute(parts, {
      name: "tbl.orderRow",
      part: "ppt/slides/slide1.xml",
      row: 2,
      before: 1,
    })
    const after = moved.get("ppt/slides/slide1.xml")
    if (after === undefined) throw new Error("part")
    expect(markupDocument(after).wellFormed).toBe(true)
    expect(frameMarks(after)).toEqual([
      { id: "2", name: "A" },
      { id: "3", name: "B" },
    ])
    const row = markupDocument(after).elements.filter((element) => element.kind === "a:tr")
    expect(decodeUtf8(after.slice(row[0]?.start ?? 0, row[0]?.end ?? 0))).toContain(">B<")
    expect(decodeUtf8(after.slice(row[1]?.start ?? 0, row[1]?.end ?? 0))).toContain(">A<")
    expect(elementBytes(after, "p:graphicFrame", "2").byteLength).toBeGreaterThan(0)
    expect(elementBytes(after, "p:graphicFrame", "3").byteLength).toBeGreaterThan(0)
    expect(first.byteLength).toBeGreaterThan(0)
    expect(second.byteLength).toBeGreaterThan(0)
  })
})

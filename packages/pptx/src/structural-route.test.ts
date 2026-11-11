import { describe, expect, it } from "vitest"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { applyRoute, shapeById } from "./slide-route.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"
import { applyStructuralRoute, writeStructuralRoute } from "./structural-route.js"

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
const slideRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`
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

function sectionIds(parts: ReadonlyMap<string, Uint8Array>): string[] {
  const bytes = parts.get("ppt/presentation.xml")
  if (bytes === undefined) throw new Error("part")
  return markupDocument(bytes)
    .elements.filter((element) => element.kind === "p14:section" && element.id !== null)
    .sort((left, right) => left.start - right.start)
    .flatMap((element) => (element.id === null ? [] : [element.id]))
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

  it("gives every shape in a cloned group its own id", () => {
    const group = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:grpSp><p:nvGrpSpPr><p:cNvPr id="10" name="G"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="11" name="A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="12" name="B"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr></p:sp></p:grpSp></p:spTree></p:cSld></p:sld>`
    const parts = deck(group)
    const cloned = applyStructuralRoute(parts, { name: "spTree.clone", part: "ppt/slides/slide1.xml", shape: "10" })
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(cloned))).toEqual([])
    const ids = shapeIdCounts(cloned)
      .filter((row) => row.part === "ppt/slides/slide1.xml")
      .map((row) => row.id)
    expect(ids).toEqual(expect.arrayContaining(["1", "10", "11", "12"]))
    expect(ids).toHaveLength(7)
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
    const added = writeStructuralRoute(parts, { name: "sldIdLst.add", after: "256" })
    expect(added.id).toBe("257")
    const addedSlide = xml(added.parts, "ppt/slides/slide2.xml")
    expect(addedSlide).toContain('name=""')
    expect(addedSlide).not.toContain("One")
    const blankRels = xml(added.parts, "ppt/slides/_rels/slide2.xml.rels")
    expect(blankRels).toContain(
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"',
    )
    expect(blankRels).not.toContain("notesSlide")
    expect(xml(added.parts, "ppt/_rels/presentation.xml.rels")).toContain(
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>',
    )
    expect(xml(added.parts, "[Content_Types].xml")).toContain(
      '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>',
    )
    const back = applyStructuralRoute(added.parts, { name: "sldIdLst.remove", slide: "257" })
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
    expect(addedXml).toContain(
      '<p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p14:section ',
    )
    expect(addedXml).not.toContain("<p:sectionLst>")
    const id = sectionIds(added)[0]
    if (id === undefined) throw new Error("section")
    const back = applyStructuralRoute(added, { name: "sectionLst.remove", section: id })
    expect(back.get("ppt/presentation.xml")).toEqual(parts.get("ppt/presentation.xml"))
    expect(back.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
  })

  it("reorders sections and the second move restores the presentation", () => {
    const parts = deck()
    const first = applyStructuralRoute(parts, { name: "sectionLst.add", title: "One" })
    const second = applyStructuralRoute(first, { name: "sectionLst.add", title: "Two" })
    const secondXml = xml(second, "ppt/presentation.xml")
    expect(secondXml.match(/<p14:sectionLst/g)?.length).toBe(1)
    expect(secondXml).not.toContain("<p:sectionLst>")
    const ids = sectionIds(second)
    const later = ids[1]
    const earlier = ids[0]
    if (later === undefined || earlier === undefined) throw new Error("section")
    const moved = applyStructuralRoute(second, { name: "sectionLst.order", section: later, before: earlier })
    const movedXml = xml(moved, "ppt/presentation.xml")
    expect(movedXml.indexOf('name="Two"')).toBeLessThan(movedXml.indexOf('name="One"'))
    const back = applyStructuralRoute(moved, { name: "sectionLst.order", section: earlier, before: later })
    expect(back.get("ppt/presentation.xml")).toEqual(second.get("ppt/presentation.xml"))
  })

  it("adds a table frame and remove restores the slide", () => {
    const parts = deck()
    const added = applyStructuralRoute(parts, { name: "graphicFrame.addTable", part: "ppt/slides/slide1.xml" })
    const addedXml = xml(added, "ppt/slides/slide1.xml")
    expect(addedXml).toContain('<p:cNvPr id="4" name="Table 4"/>')
    expect(addedXml).toContain(">One<")
    expect(addedXml.indexOf("<a:tblPr")).toBeLessThan(addedXml.indexOf("<a:tblGrid"))
    expect(addedXml.indexOf("<a:txBody")).toBeLessThan(addedXml.indexOf("<a:tcPr"))
    const back = applyStructuralRoute(added, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "4" })
    expect(back.get("ppt/slides/slide1.xml")).toEqual(parts.get("ppt/slides/slide1.xml"))
  })

  it("copies a table row and the inverse order restores the part", () => {
    const parts = deck(table)
    const added = applyStructuralRoute(parts, { name: "tbl.addRow", part: "ppt/slides/slide1.xml", row: 1 })
    expect(xml(added, "ppt/slides/slide1.xml").match(/<a:tr /g)?.length).toBe(3)
    expect(added.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
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

  it("keeps the presentation, its relationships, content types, and media for a shape or table edit", () => {
    const shapeDeck = deck()
    const tableDeck = deck(table)
    const checks: [Map<string, Uint8Array>, Parameters<typeof applyStructuralRoute>[1]][] = [
      [shapeDeck, { name: "spTree.order", part: "ppt/slides/slide1.xml", shape: "3", before: "2" }],
      [shapeDeck, { name: "spTree.clone", part: "ppt/slides/slide1.xml", shape: "2" }],
      [shapeDeck, { name: "spTree.remove", part: "ppt/slides/slide1.xml", shape: "2" }],
      [shapeDeck, { name: "spTree.add", part: "ppt/slides/slide1.xml", text: "New", x: 0, y: 0, cx: 1, cy: 1 }],
      [shapeDeck, { name: "graphicFrame.addTable", part: "ppt/slides/slide1.xml" }],
      [tableDeck, { name: "tbl.addRow", part: "ppt/slides/slide1.xml", row: 1 }],
      [tableDeck, { name: "tbl.removeRow", part: "ppt/slides/slide1.xml", row: 2 }],
      [tableDeck, { name: "tbl.orderRow", part: "ppt/slides/slide1.xml", row: 2, before: 1 }],
    ]
    for (const [source, route] of checks) {
      const edited = applyStructuralRoute(source, route)
      expect(edited.get("ppt/presentation.xml")).toBe(source.get("ppt/presentation.xml"))
      expect(edited.get("ppt/_rels/presentation.xml.rels")).toBe(source.get("ppt/_rels/presentation.xml.rels"))
      expect(edited.get("[Content_Types].xml")).toBe(source.get("[Content_Types].xml"))
      expect(edited.get("ppt/media/keep.bin")).toBe(source.get("ppt/media/keep.bin"))
    }
  })

  it("adds the next slide after the highest file number when a number is missing", () => {
    const parts = deck()
    const slide3 = text("<p:sld/>")
    parts.set("ppt/slides/slide3.xml", slide3)
    const added = applyStructuralRoute(parts, { name: "sldIdLst.add", after: "256" })
    expect(added.has("ppt/slides/slide2.xml")).toBe(false)
    expect(added.has("ppt/slides/slide4.xml")).toBe(true)
    expect(added.get("ppt/slides/slide3.xml")).toBe(slide3)
    expect(added.get("ppt/slides/slide1.xml")).toBe(parts.get("ppt/slides/slide1.xml"))
  })

  it("moves an earlier shape forward without breaking the markup", () => {
    const three = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="B"/></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="C"/></p:nvSpPr></p:sp></p:spTree></p:cSld></p:sld>`
    const parts = deck(three)
    const moved = applyStructuralRoute(parts, {
      name: "spTree.order",
      part: "ppt/slides/slide1.xml",
      shape: "2",
      before: "4",
    })
    const movedBytes = moved.get("ppt/slides/slide1.xml")
    if (movedBytes === undefined) throw new Error("part")
    expect(markupDocument(movedBytes).wellFormed).toBe(true)
    const movedXml = decodeUtf8(movedBytes)
    const id2 = movedXml.indexOf('id="2"')
    const id3 = movedXml.indexOf('id="3"')
    const id4 = movedXml.indexOf('id="4"')
    expect(id3).toBeLessThan(id2)
    expect(id2).toBeLessThan(id4)
  })

  it("moves an earlier table row forward without breaking the markup", () => {
    const three = `<p:sld><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr><a:tr h="1"><a:tc><a:t>B</a:t></a:tc></a:tr><a:tr h="1"><a:tc><a:t>C</a:t></a:tc></a:tr></a:tbl></p:sld>`
    const parts = deck(three)
    const moved = applyStructuralRoute(parts, {
      name: "tbl.orderRow",
      part: "ppt/slides/slide1.xml",
      row: 1,
      before: 3,
    })
    const movedBytes = moved.get("ppt/slides/slide1.xml")
    if (movedBytes === undefined) throw new Error("part")
    expect(markupDocument(movedBytes).wellFormed).toBe(true)
    const movedXml = decodeUtf8(movedBytes)
    expect(movedXml.indexOf(">B<")).toBeLessThan(movedXml.indexOf(">A<"))
    expect(movedXml.indexOf(">A<")).toBeLessThan(movedXml.indexOf(">C<"))
  })

  it("refuses to remove the only row of a table", () => {
    const one = `<p:sld><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr></a:tbl></p:sld>`
    expect(() =>
      applyStructuralRoute(deck(one), { name: "tbl.removeRow", part: "ppt/slides/slide1.xml", row: 1 }),
    ).toThrow(/a:tr/)
    const mixed = `<p:sld><a:tbl><a:tr h="1"><a:tc><a:t>A</a:t></a:tc></a:tr><a:tr h="1"><a:tc><a:t>B</a:t></a:tc></a:tr></a:tbl><a:tbl><a:tr h="1"><a:tc><a:t>C</a:t></a:tc></a:tr></a:tbl></p:sld>`
    expect(() =>
      applyStructuralRoute(deck(mixed), { name: "tbl.removeRow", part: "ppt/slides/slide1.xml", row: 3 }),
    ).toThrow(/a:tr/)
    const removed = applyStructuralRoute(deck(mixed), {
      name: "tbl.removeRow",
      part: "ppt/slides/slide1.xml",
      row: 1,
    })
    const removedBytes = removed.get("ppt/slides/slide1.xml")
    if (removedBytes === undefined) throw new Error("part")
    expect(markupDocument(removedBytes).wellFormed).toBe(true)
    const removedXml = decodeUtf8(removedBytes)
    expect(removedXml).toContain(">B<")
    expect(removedXml).toContain(">C<")
    expect(removedXml).not.toContain(">A<")
  })
})

describe("removing a shape something refers to", () => {
  const part = "ppt/slides/slide1.xml"
  const plain = (id: number) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="S"/></p:nvSpPr></p:sp>`
  const group = (id: number, inner: string) =>
    `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="G"/></p:nvGrpSpPr>${inner}</p:grpSp>`
  const connector = (id: number, ends: string) =>
    `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="C"/><p:cNvCxnSpPr>${ends}</p:cNvCxnSpPr></p:nvCxnSpPr></p:cxnSp>`
  const onSlide = (shapes: string, timing = "") =>
    `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr>${shapes}</p:spTree></p:cSld>${timing}</p:sld>`
  const timed = (reference: string) => `<p:timing>${reference}</p:timing>`
  const removed = (source: string, shape: string) =>
    xml(applyStructuralRoute(deck(source), { name: "spTree.remove", part, shape }), part)

  function expectRefused(source: string, shape: string) {
    const parts = deck(source)
    const held = parts.get(part)
    expect(() => applyStructuralRoute(parts, { name: "spTree.remove", part, shape })).toThrow(/^shape-animated$/)
    expect(() => applyRoute(parts, { name: "remove", part, shape })).toThrow(/^shape-animated$/)
    expect(parts.get(part)).toBe(held)
    expect(decodeUtf8(held ?? new Uint8Array())).toBe(source)
  }

  it("refuses a shape a p:spTgt targets and writes nothing", () => {
    expectRefused(onSlide(plain(2) + plain(3), timed(`<p:spTgt spid="2"/>`)), "2")
  })

  it("refuses a shape a p:bldP builds and writes nothing", () => {
    expectRefused(onSlide(plain(2) + plain(3), timed(`<p:bldP spid="2" grpId="0"/>`)), "2")
  })

  it.each(["p:bldDgm", "p:bldOleChart", "p:bldGraphic", "p:inkTgt"])("refuses a shape a %s names", (kind) => {
    expectRefused(onSlide(plain(2), timed(`<${kind} spid="2"/>`)), "2")
  })

  it("refuses a group whose child is animated and writes nothing", () => {
    expectRefused(onSlide(group(2, plain(3)) + plain(4), timed(`<p:spTgt spid="3"/>`)), "2")
  })

  it("refuses a group nested in a group whose deep child is animated", () => {
    expectRefused(onSlide(group(2, group(3, plain(4))), timed(`<p:spTgt spid="4"/>`)), "2")
  })

  it("cuts a connector's a:stCxn and only those bytes besides the shape", () => {
    const start = `<a:stCxn id="2" idx="1"/>`
    const end = `<a:endCxn id="3" idx="0"/>`
    expect(removed(onSlide(plain(2) + plain(3) + connector(4, start + end)), "2")).toBe(
      onSlide(plain(3) + connector(4, end)),
    )
  })

  it("cuts a connector's a:endCxn and only those bytes besides the shape", () => {
    const start = `<a:stCxn id="2" idx="1"/>`
    const end = `<a:endCxn id="3" idx="0"/>`
    expect(removed(onSlide(plain(2) + plain(3) + connector(4, start + end)), "3")).toBe(
      onSlide(plain(2) + connector(4, start)),
    )
  })

  it("cuts both ends and every connector attached to the shape", () => {
    const both = `<a:stCxn id="2" idx="1"/><a:endCxn id="2" idx="3"/>`
    expect(removed(onSlide(connector(4, both) + plain(2) + connector(5, `<a:endCxn id="2" idx="0"/>`)), "2")).toBe(
      onSlide(connector(4, "") + connector(5, "")),
    )
  })

  it("cuts an attachment written with a close tag", () => {
    expect(removed(onSlide(plain(2) + connector(4, `<a:stCxn id="2" idx="1"></a:stCxn>`)), "2")).toBe(
      onSlide(connector(4, "")),
    )
  })

  it("cuts an attachment to a child of a removed group", () => {
    const attached = connector(5, `<a:stCxn id="3" idx="1"/>`)
    expect(removed(onSlide(group(2, plain(3)) + attached), "2")).toBe(onSlide(connector(5, "")))
  })

  it("removes a group holding a connector attached inside it without a second cut", () => {
    const inner = plain(3) + connector(4, `<a:stCxn id="3" idx="1"/>`)
    expect(removed(onSlide(group(2, inner) + plain(5)), "2")).toBe(onSlide(plain(5)))
  })

  it("the slide route cuts an attachment the same way", () => {
    const source = onSlide(plain(2) + connector(4, `<a:stCxn id="2" idx="1"/>`))
    expect(xml(applyRoute(deck(source), { name: "remove", part, shape: "2" }), part)).toBe(onSlide(connector(4, "")))
  })

  it("removes an unreferenced shape exactly as before and leaves other references", () => {
    const kept = plain(3) + connector(4, `<a:stCxn id="3" idx="1"/>`)
    const timing = timed(`<p:spTgt spid="3"/><p:bldP spid="3" grpId="0"/>`)
    expect(removed(onSlide(plain(2) + kept, timing), "2")).toBe(onSlide(kept, timing))
  })

  it("does not read a spid outside p:timing as a reference to the shape", () => {
    const shapes = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:oleObj spid="3"/></p:sp>${plain(3)}`
    expect(removed(onSlide(shapes), "3")).toContain(`<p:oleObj spid="3"/>`)
  })

  it.each(["p14:bmkTgt", "p:subSp", "x:anything"])("refuses a shape a %s inside p:timing names", (kind) => {
    expectRefused(onSlide(plain(2), timed(`<${kind} spid="2"/>`)), "2")
  })

  it("refuses a shape named from timing held in mc:Choice", () => {
    expectRefused(
      onSlide(
        plain(2),
        `<mc:AlternateContent><mc:Choice>${timed(`<p:spTgt spid="2"/>`)}</mc:Choice></mc:AlternateContent>`,
      ),
      "2",
    )
  })

  it.each(["05", "+5", "&#53;", "&#x35;", " 5 "])("refuses shape 5 targeted as %j", (form) => {
    expectRefused(onSlide(plain(5), timed(`<p:spTgt spid="${form}"/>`)), "5")
  })

  it("refuses a shape written 05 targeted as 5", () => {
    const shape = `<p:sp><p:nvSpPr><p:cNvPr id="05" name="S"/></p:nvSpPr></p:sp>`
    expectRefused(onSlide(shape, timed(`<p:spTgt spid="5"/>`)), "05")
  })

  it.each(["05", "+5", "&#53;"])("cuts a connector end written %j and only those bytes", (form) => {
    const kept = `<a:endCxn id="03" idx="0"/>`
    const source = onSlide(plain(5) + plain(3) + connector(6, `<a:stCxn id="${form}" idx="1"/>${kept}`))
    expect(removed(source, "5")).toBe(onSlide(plain(3) + connector(6, kept)))
  })

  it("refuses a group holding an animated p14:cNvPr content part", () => {
    const ink = `<p:contentPart><p14:nvContentPartPr><p14:cNvPr id="5" name="Ink"/></p14:nvContentPartPr></p:contentPart>`
    expectRefused(onSlide(group(8, ink), timed(`<p:inkTgt spid="5"/>`)), "8")
    expectRefused(onSlide(group(8, ink), timed(`<p:spTgt spid="5"/>`)), "8")
  })

  it("cuts a connector attached to a p14:cNvPr content part in a removed group", () => {
    const ink = `<p:contentPart><p14:nvContentPartPr><p14:cNvPr id="5" name="Ink"/></p14:nvContentPartPr></p:contentPart>`
    expect(removed(onSlide(group(8, ink) + connector(6, `<a:stCxn id="5" idx="0"/>`)), "8")).toBe(
      onSlide(connector(6, "")),
    )
  })

  const frame = (id: number, inner: string) =>
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="F"/></p:nvGraphicFramePr><a:graphic><a:graphicData uri="u">${inner}</a:graphicData></a:graphic></p:graphicFrame>`
  const canvas = (id: number) => `<a:sp><a:nvSpPr><a:cNvPr id="${id}" name="In"/></a:nvSpPr></a:sp>`

  it("keeps a live connector when a removed frame's canvas reuses the id it attaches to", () => {
    const kept = plain(2) + connector(4, `<a:stCxn id="2" idx="0"/>`)
    expect(removed(onSlide(frame(10, canvas(2)) + kept), "10")).toBe(onSlide(kept))
  })

  it("does not refuse a frame because a canvas inside it reuses an animated id", () => {
    const timing = timed(`<p:spTgt spid="2"/>`)
    expect(removed(onSlide(frame(10, canvas(2)) + plain(2), timing), "10")).toBe(onSlide(plain(2), timing))
  })

  it("refuses a frame whose own id is animated", () => {
    expectRefused(onSlide(frame(10, canvas(2)), timed(`<p:spTgt spid="10"/>`)), "10")
  })

  it.each(["p:spTgt", "p:inkTgt", "p:bldP", "p:bldDgm", "p:bldOleChart", "p:bldGraphic"])(
    "refuses a shape a %s outside p:timing names",
    (kind) => {
      expectRefused(onSlide(plain(2), `<${kind} spid="2"/>`), "2")
    },
  )

  it("refuses a shape targeted several levels under p:timing", () => {
    const deep = `<p:tnLst><p:par><p:cTn><p:childTnLst><p:set><p:cBhvr><p:tgtEl><p14:bmkTgt spid="2"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst>`
    expectRefused(onSlide(plain(2), timed(deep)), "2")
  })
})

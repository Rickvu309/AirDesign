import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { exportElements, type ElementEdit } from "./element-export.js"
import { exportPackage } from "./export-package.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { createdShapesLanded, elementExportTouch, touchMatches } from "./route-parts.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"
import { applyStructuralRoute } from "./structural-route.js"

const slideA = "n000000000001"
const slideB = "n000000000002"
const shapeA = "n000000000003"
const shapeB = "n000000000004"
const high = "nzzzzzzzzzzzz"
const box = { x: 914400, y: 914400, cx: 914400, cy: 457200 }
const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:txBody><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const other = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="8" name="B"/></p:nvSpPr></p:sp></p:spTree></p:cSld></p:sld>`
const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const twoSlides = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
const twoRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`
const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`
const slideRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`

function text(value: string): Uint8Array {
  return encodeUtf8(value)
}

function deck(): Map<string, Uint8Array> {
  return new Map([
    ["ppt/slides/slide1.xml", text(slide)],
    ["ppt/slides/_rels/slide1.xml.rels", text(slideRels)],
    ["ppt/presentation.xml", text(presentation)],
    ["ppt/_rels/presentation.xml.rels", text(rels)],
    ["[Content_Types].xml", text(types)],
    ["ppt/media/keep.bin", Uint8Array.from([1, 0, 255])],
  ])
}

function twoDeck(): Map<string, Uint8Array> {
  const parts = deck()
  parts.set("ppt/slides/slide2.xml", text(other))
  parts.set("ppt/slides/_rels/slide2.xml.rels", text(slideRels))
  parts.set("ppt/presentation.xml", text(twoSlides))
  parts.set("ppt/_rels/presentation.xml.rels", text(twoRels))
  return parts
}

function add(id: string, value: string): ElementEdit {
  return { id, name: "add", text: value, ...box }
}

function sameBytes(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  if (left === undefined || right === undefined || left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function rowsFor(parts: ReadonlyMap<string, Uint8Array>, value: string) {
  return readShapes(parts).filter((row) => row.text === value)
}

describe("exportElements", () => {
  it("puts each created shape on the slide that was written for it", () => {
    const parts = deck()
    const kept = parts.get("ppt/media/keep.bin")
    const written = exportElements(parts, [add(`${slideA}.${shapeA}`, "ALPHA"), add(`${slideB}.${shapeB}`, "BETA")])
    const alpha = rowsFor(written.parts, "ALPHA")
    const beta = rowsFor(written.parts, "BETA")
    expect(alpha).toHaveLength(1)
    expect(beta).toHaveLength(1)
    expect(alpha[0]).toMatchObject({ slide: "257", shape: "2", part: "ppt/slides/slide2.xml" })
    expect(beta[0]).toMatchObject({ slide: "258", shape: "2", part: "ppt/slides/slide3.xml" })
    expect(decodeUtf8(written.parts.get("ppt/slides/slide2.xml") ?? text(""))).not.toContain("BETA")
    expect(decodeUtf8(written.parts.get("ppt/slides/slide3.xml") ?? text(""))).not.toContain("ALPHA")
    expect(written.parts.get("ppt/media/keep.bin")).toBe(kept)
    expect(parts.get("ppt/media/keep.bin")).toBe(kept)
  })

  it("puts a created shape on its own slide when another add took the next number", () => {
    const parts = deck()
    const alone = applyStructuralRoute(deck(), { name: "sldIdLst.add", after: "256" })
    const written = exportElements(parts, [{ name: "sldIdLst.add", after: "256" }, add(`${slideA}.${shapeA}`, "ALPHA")])
    const alpha = rowsFor(written.parts, "ALPHA")
    expect(alpha).toHaveLength(1)
    expect(alpha[0]).toMatchObject({ slide: "258", shape: "2", part: "ppt/slides/slide3.xml" })
    expect(sameBytes(written.parts.get("ppt/slides/slide2.xml"), alone.get("ppt/slides/slide2.xml"))).toBe(true)
    expect(decodeUtf8(written.parts.get("ppt/slides/slide2.xml") ?? text(""))).not.toContain("ALPHA")
    expect(rowsFor(written.parts, "ALPHA").some((row) => row.slide === "257")).toBe(false)
  })

  it("writes two names for one part as two shapes", () => {
    const parts = twoDeck()
    const written = exportElements(parts, [add(`${slideA}.${high}`, "ZED"), add(`258.${slideA}`, "NUM")])
    const num = rowsFor(written.parts, "NUM")
    const zed = rowsFor(written.parts, "ZED")
    expect(num).toHaveLength(1)
    expect(zed).toHaveLength(1)
    expect(num[0]).toMatchObject({ slide: "258", shape: "2" })
    expect(zed[0]).toMatchObject({ slide: "258", shape: "3" })
    expect(num[0]?.part).toBe(zed[0]?.part)
    expect(rowsFor(written.parts, "NUM").some((row) => row.slide === "256" || row.slide === "257")).toBe(false)
    expect(rowsFor(written.parts, "ZED").some((row) => row.slide === "256" || row.slide === "257")).toBe(false)
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(written.parts))).toEqual([])
    expect(decodeUtf8(written.parts.get(num[0]?.part ?? "") ?? text(""))).toContain("NUM")
    expect(decodeUtf8(written.parts.get(zed[0]?.part ?? "") ?? text(""))).toContain("ZED")
  })

  it("writes one shape when two names share one token", () => {
    const parts = twoDeck()
    const written = exportElements(parts, [add(`${slideA}.${shapeA}`, "ALPHA"), add(`258.${shapeA}`, "ALSO")])
    const rows = readShapes(written.parts).filter((row) => row.text === "ALPHA" || row.text === "ALSO")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ slide: "258", shape: "2", text: "ALSO" })
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(written.parts))).toEqual([])
  })

  it("exports the same creates to the same bytes in any order", async () => {
    const creates: ElementEdit[] = [
      { name: "sldIdLst.add", after: "256" },
      add(`${slideA}.${shapeA}`, "ALPHA"),
      add(`${slideB}.${shapeB}`, "BETA"),
    ]
    const original = deck()
    const once = await exportPackage(exportElements(original, creates).parts)
    const twice = await exportPackage(exportElements(original, creates).parts)
    expect(sameBytes(once, twice)).toBe(true)
    await fc.assert(
      fc.asyncProperty(fc.shuffledSubarray(creates, { minLength: creates.length }), async (order) => {
        const file = await exportPackage(exportElements(deck(), order).parts)
        expect(sameBytes(file, once)).toBe(true)
      }),
      { numRuns: 20 },
    )
  })

  it("rejects a created shape that was written onto another slide", () => {
    const before = deck()
    const edits: ElementEdit[] = [
      { name: "sldIdLst.add", after: "256" },
      add(`${slideA}.${shapeA}`, "ALPHA"),
      add(`${slideB}.${shapeB}`, "BETA"),
    ]
    const written = exportElements(before, edits)
    const touch = elementExportTouch(before)
    const landed = [
      { text: "ALPHA", slide: "258" },
      { text: "BETA", slide: "259" },
    ]
    const untouched = ["257"]
    expect(touchMatches(before, written.parts, touch)).toBe(true)
    expect(createdShapesLanded(written.parts, landed, untouched)).toBe(true)
    const alpha = rowsFor(written.parts, "ALPHA")[0]
    const beta = rowsFor(written.parts, "BETA")[0]
    if (alpha === undefined || beta === undefined) throw new Error("shape")
    const wrong = new Map(written.parts)
    const alphaBytes = wrong.get(alpha.part)
    const betaBytes = wrong.get(beta.part)
    if (alphaBytes === undefined || betaBytes === undefined) throw new Error("part")
    wrong.set(alpha.part, betaBytes)
    wrong.set(beta.part, alphaBytes)
    expect(touchMatches(before, wrong, touch)).toBe(true)
    expect(createdShapesLanded(wrong, landed, untouched)).toBe(false)
  })

  it("throws when an edit names a shape nothing created and leaves the file", () => {
    const parts = deck()
    const before = parts.get("ppt/slides/slide1.xml")
    expect(() => exportElements(parts, [{ id: `256.${shapeA}`, name: "text", text: "NO" }])).toThrow(/shape/)
    expect(parts.get("ppt/slides/slide1.xml")).toBe(before)
    expect(parts.has("ppt/slides/slide2.xml")).toBe(false)
  })

  it("throws when an edit names a slide the file does not have and leaves the file", () => {
    const parts = deck()
    const before = parts.get("ppt/presentation.xml")
    expect(() => exportElements(parts, [{ id: "999.2", name: "text", text: "NO" }])).toThrow(/slide/)
    expect(parts.get("ppt/presentation.xml")).toBe(before)
  })
})

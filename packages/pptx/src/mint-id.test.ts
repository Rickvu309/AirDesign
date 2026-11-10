import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8, readParts } from "./package-bytes.js"
import { exportPackage } from "./export-package.js"
import { readShapes } from "./read-shapes.js"
import { newDuplicateShapeIds, nextShapeId, shapeIdCounts } from "./shape-id.js"
import { applyRoute } from "./slide-route.js"
import { applyStructuralRoute } from "./structural-route.js"
import { applyMinted, mintIds } from "./mint-id.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")

const low = "n0123456789ab"
const high = "nzzzzzzzzzzzz"
const token = "n000000000001"
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
  parts.set("ppt/presentation.xml", text(twoSlides))
  parts.set("ppt/_rels/presentation.xml.rels", text(twoRels))
  return parts
}

function xmlParts(parts: ReadonlyMap<string, Uint8Array>): string {
  let joined = ""
  for (const [name, bytes] of parts) {
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue
    joined += decodeUtf8(bytes)
  }
  return joined
}

describe("mintIds", () => {
  it("refuses an id that is not a slide and a shape", () => {
    expect(() => mintIds(new Map(), ["256"])).toThrow(/element id/)
    expect(() => mintIds(new Map(), ["12345678901.2"])).toThrow(/element id/)
    expect(() => mintIds(new Map(), ["256.N0123456789ab"])).toThrow(/element id/)
    expect(() => mintIds(new Map(), [`${low}.2`])).toThrow(/slide/)
  })

  it("mints created halves in sorted order and leaves the file alone", () => {
    const parts = deck()
    const slidePart = parts.get("ppt/slides/slide1.xml")
    const earlier = `256.${low}`
    const later = `256.${high}`
    const createdSlide = `${high}.2`
    const minted = mintIds(parts, [later, createdSlide, earlier])
    expect(minted.shapes.get(earlier)).toBe("3")
    expect(minted.shapes.get(later)).toBe("4")
    expect(minted.slides.get(high)).toBe("257")
    expect(minted.slides.get(low)).toBeUndefined()
    expect(parts.get("ppt/slides/slide1.xml")).toBe(slidePart)
    expect(xmlParts(parts).includes(low)).toBe(false)
    expect(xmlParts(parts).includes(high)).toBe(false)
    const again = mintIds(parts, [earlier, later, createdSlide], minted)
    expect(again).toEqual(minted)
    expect(mintIds(parts, [later, earlier]).shapes).toEqual(mintIds(parts, [earlier, later]).shapes)
  })

  it("mints a shape from the slide it is on", () => {
    const parts = twoDeck()
    const minted = mintIds(parts, [`256.${low}`, `257.${low}`])
    expect(minted.shapes.get(`256.${low}`)).toBe("3")
    expect(minted.shapes.get(`257.${low}`)).toBe("9")
  })

  it("numbers two ids for one part once each", () => {
    const parts = twoDeck()
    const created = `${token}.${high}`
    const first = mintIds(parts, [created])
    expect(first.slides.get(token)).toBe("258")
    expect(first.shapes.has(created)).toBe(false)
    const ready = twoDeck()
    ready.set("ppt/slides/slide3.xml", text(slide))
    ready.set(
      "ppt/presentation.xml",
      text(
        `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="258" r:id="rId4"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`,
      ),
    )
    ready.set(
      "ppt/_rels/presentation.xml.rels",
      text(
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide3.xml"/></Relationships>`,
      ),
    )
    const numeric = `258.${token}`
    const same = `${token}.${token}`
    const second = mintIds(ready, [created, numeric, same], first)
    expect(second.slides.get(token)).toBe("258")
    expect(second.shapes.get(numeric)).toBe("3")
    expect(second.shapes.get(same)).toBe("3")
    expect(second.shapes.get(created)).toBe("4")
    const add = { name: "add" as const, text: "A", x: 0, y: 0, cx: 914400, cy: 457200 }
    let edited = applyMinted(ready, { ...add, id: numeric }, second)
    edited = applyMinted(edited, { ...add, id: created, text: "B" }, second)
    expect(newDuplicateShapeIds(shapeIdCounts(ready), shapeIdCounts(edited))).toEqual([])
    expect(xmlParts(edited).includes(token)).toBe(false)
    expect(xmlParts(edited).includes(high)).toBe(false)
  })

  it("numbers a complete set the same way for either call order", () => {
    const parts = deck()
    const zero = `256.${token}`
    const zed = `256.${high}`
    const zeroFirst = mintIds(parts, [zed, zero], mintIds(parts, [zero]))
    const zedFirst = mintIds(parts, [zero, zed], mintIds(parts, [zed]))
    expect(zeroFirst).toEqual(zedFirst)
    expect(zeroFirst.shapes.get(zero)).toBe("3")
    expect(zeroFirst.shapes.get(zed)).toBe("4")
  })

  it("keeps a minted slide number when the shape can be numbered later", () => {
    const parts = deck()
    const created = `${low}.${high}`
    const first = mintIds(parts, [created])
    expect(first.slides.get(low)).toBe("257")
    expect(first.shapes.has(created)).toBe(false)
    const added = applyStructuralRoute(parts, { name: "sldIdLst.add", after: "256" })
    const second = mintIds(added, [created], first)
    expect(second.slides.get(low)).toBe("257")
    const part = [...added.keys()].find((name) => name === "ppt/slides/slide2.xml")
    const bytes = part === undefined ? undefined : added.get(part)
    if (bytes === undefined) throw new Error("part")
    expect(second.shapes.get(created)).toBe(String(nextShapeId(decodeUtf8(bytes))))
    expect(xmlParts(added).includes(low)).toBe(false)
  })
})

describe("applyMinted", () => {
  it("refuses a minted add when that shape id is already in the part", () => {
    const parts = deck()
    const id = `256.${token}`
    const minted = mintIds(parts, [id])
    expect(minted.shapes.get(id)).toBe("3")
    const taken = applyRoute(parts, {
      name: "add",
      part: "ppt/slides/slide1.xml",
      text: "Plain",
      x: 0,
      y: 0,
      cx: 914400,
      cy: 457200,
    })
    const before = taken.get("ppt/slides/slide1.xml")
    expect(() =>
      applyMinted(taken, { id, name: "add", text: "Minted", x: 0, y: 0, cx: 914400, cy: 457200 }, minted),
    ).toThrow(/shape id/)
    expect(taken.get("ppt/slides/slide1.xml")).toBe(before)
  })

  it("edits the shape on the slide the id names", () => {
    const parts = deck()
    const minted = mintIds(parts, ["256.2"])
    const edited = applyMinted(parts, { id: "256.2", name: "text", text: "Next" }, minted)
    expect(readShapes(edited).find((row) => row.shape === "2")?.text).toBe("Next")
    expect(edited.get("ppt/media/keep.bin")).toBe(parts.get("ppt/media/keep.bin"))
    expect(() => applyMinted(parts, { id: "999.2", name: "remove" }, minted)).toThrow(/slide/)
    expect(() => applyMinted(parts, { id: `256.${low}`, name: "remove" }, minted)).toThrow(/shape/)
  })

  it("writes minted shape ids in sorted order and adds no duplicate", () => {
    const parts = deck()
    const earlier = `256.${low}`
    const later = `256.${high}`
    const minted = mintIds(parts, [later, earlier])
    let edited = applyMinted(
      parts,
      { id: later, name: "add", text: "Later", x: 0, y: 0, cx: 914400, cy: 457200 },
      minted,
    )
    edited = applyMinted(
      edited,
      { id: earlier, name: "add", text: "Earlier", x: 0, y: 0, cx: 914400, cy: 457200 },
      minted,
    )
    edited = applyMinted(edited, { id: earlier, name: "text", text: "Changed" }, minted)
    const rows = readShapes(edited)
    expect(rows.find((row) => row.shape === "4")?.text).toBe("Later")
    expect(rows.find((row) => row.shape === "3")?.text).toBe("Changed")
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(edited))).toEqual([])
    expect(xmlParts(edited).includes(low)).toBe(false)
    expect(xmlParts(edited).includes(high)).toBe(false)
  })

  it("resolves a minted slide id through presentation.xml", () => {
    const parts = deck()
    const minted = mintIds(parts, [`${low}.2`])
    const added = applyStructuralRoute(parts, { name: "sldIdLst.clone", slide: "256" })
    const removed = applyMinted(added, { id: `${low}.2`, name: "remove" }, minted)
    const rows = readShapes(removed)
    expect(rows.some((row) => row.slide === "256" && row.shape === "2")).toBe(true)
    expect(rows.some((row) => row.slide === "257" && row.shape === "2")).toBe(false)
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(removed))).toEqual([])
    expect(xmlParts(removed).includes(low)).toBe(false)
  })

  it("mints two shapes on clean.pptx and adds no duplicate id", async () => {
    const parts = await readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/clean.pptx`))
    const slidePart = parts.get("ppt/slides/slide1.xml")
    if (slidePart === undefined) throw new Error("part")
    const first = nextShapeId(decodeUtf8(slidePart))
    const earlier = `256.${low}`
    const later = `256.${high}`
    const minted = mintIds(parts, [later, earlier])
    expect(minted.shapes.get(earlier)).toBe(String(first))
    expect(minted.shapes.get(later)).toBe(String(first + 1))
    let edited = applyMinted(
      parts,
      { id: later, name: "add", text: "Later", x: 0, y: 0, cx: 914400, cy: 457200 },
      minted,
    )
    edited = applyMinted(
      edited,
      { id: earlier, name: "add", text: "Earlier", x: 0, y: 0, cx: 914400, cy: 457200 },
      minted,
    )
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(edited))).toEqual([])
    expect(xmlParts(edited).includes(low)).toBe(false)
    const written = await exportPackage(edited)
    const read = await readParts(written)
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(read))).toEqual([])
  })
})

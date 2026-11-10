import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { exportElements, idFields, type ElementEdit, type IdRole } from "./element-export.js"
import { exportPackage } from "./export-package.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readShapes } from "./read-shapes.js"
import { createdShapesLanded, elementExportTouch, touchMatches } from "./route-parts.js"
import { newDuplicateShapeIds, shapeIdCounts } from "./shape-id.js"

const slideFirst = "n000000000000"
const slideA = "n000000000001"
const slideB = "n000000000002"
const slideC = "n000000000005"
const shapeA = "n000000000003"
const shapeB = "n000000000004"
const nothingCreated = "n00000000000z"
const box = { x: 914400, y: 914400, cx: 914400, cy: 457200 }
const slide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="A"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const secondSlide = `<p:sld><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/></p:nvGrpSpPr><p:sp><p:nvSpPr><p:cNvPr id="8" name="B"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1" cy="1"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Two</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
const presentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const widePresentation = `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/><p:sldId id="300" r:id="rId2"/></p:sldIdLst><p:sldSz cx="1" cy="1"/></p:presentation>`
const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>`
const wideRels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`
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

function wideDeck(): Map<string, Uint8Array> {
  const parts = deck()
  parts.set("ppt/slides/slide2.xml", text(secondSlide))
  parts.set("ppt/slides/_rels/slide2.xml.rels", text(slideRels))
  parts.set("ppt/presentation.xml", text(widePresentation))
  parts.set("ppt/_rels/presentation.xml.rels", text(wideRels))
  return parts
}

function add(id: string, value: string): ElementEdit {
  return { id, name: "add", text: value, ...box }
}

function slideAdd(token: string, after = "256"): ElementEdit {
  return { name: "sldIdLst.add", slide: token, after }
}

function setText(id: string, value: string): ElementEdit {
  return { id, name: "text", text: value }
}

function sameBytes(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  if (left === undefined || right === undefined || left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false
  return true
}

function sameParts(left: ReadonlyMap<string, Uint8Array>, right: ReadonlyMap<string, Uint8Array>): boolean {
  if (left.size !== right.size) return false
  for (const [name, bytes] of left) if (!sameBytes(bytes, right.get(name))) return false
  return true
}

function rowsFor(parts: ReadonlyMap<string, Uint8Array>, value: string) {
  return readShapes(parts).filter((row) => row.text === value)
}

function expectUntouched(parts: ReadonlyMap<string, Uint8Array>, run: (parts: Map<string, Uint8Array>) => void): void {
  const held = new Map(parts)
  const copies = new Map([...parts].map(([name, bytes]) => [name, bytes.slice()]))
  run(parts as Map<string, Uint8Array>)
  expect(parts.size).toBe(held.size)
  for (const [name, bytes] of held) {
    expect(parts.get(name)).toBe(bytes)
    expect(sameBytes(bytes, copies.get(name))).toBe(true)
  }
}

function expectRefused(edits: readonly ElementEdit[], error: RegExp, make: () => Map<string, Uint8Array> = deck): void {
  for (const list of [edits, [...edits].reverse()]) {
    expectUntouched(make(), (parts) => expect(() => exportElements(parts, list)).toThrow(error))
  }
}

const samples: { readonly [Name in ElementEdit["name"]]: Extract<ElementEdit, { readonly name: Name }> } = {
  text: { name: "text", id: "256.2", text: "T" },
  move: { name: "move", id: "256.2", x: 1, y: 2 },
  resize: { name: "resize", id: "256.2", cx: 1, cy: 2 },
  remove: { name: "remove", id: "256.2" },
  add: { name: "add", id: `256.${shapeA}`, text: "T", ...box },
  "sldIdLst.add": { name: "sldIdLst.add", slide: slideA, after: "256" },
}

const refused: Readonly<Record<IdRole, readonly (readonly [string, RegExp])[]>> = {
  element: [
    ["999.2", /slide/],
    ["257.2", /slide/],
    ["0256.2", /slide/],
    ["256.99", /shape/],
    ["256.02", /shape/],
    [`256.${nothingCreated}`, /shape/],
    [`${nothingCreated}.${shapeA}`, /slide/],
    [`${slideC}.2`, /shape/],
    [`${slideC}.${shapeA}`, /shape/],
    ["256", /element id/],
    ["", /element id/],
  ],
  createdElement: [
    [`999.${shapeA}`, /slide/],
    [`257.${shapeA}`, /slide/],
    [`${nothingCreated}.${shapeA}`, /slide/],
    ["256.3", /shape/],
    ["256.2", /shape/],
    ["256", /element id/],
  ],
  slide: [
    ["999", /slide/],
    ["257", /slide/],
    ["0256", /slide/],
    [nothingCreated, /slide/],
    ["256.2", /element id/],
    ["", /element id/],
  ],
  createdSlide: [
    ["256", /slide/],
    ["257", /slide/],
    [slideC, /slide/],
    ["", /slide/],
  ],
}

function idCarrying(sample: ElementEdit): string[] {
  return Object.entries(sample)
    .filter(([field, value]) => field !== "name" && field !== "text" && typeof value !== "number")
    .map(([field]) => field)
}

const fieldRoles: Readonly<Record<string, Readonly<Record<string, IdRole | undefined>> | undefined>> = idFields

describe("the id resolver", () => {
  it("has a row for every edit kind and every field that carries an id", () => {
    expect(Object.keys(samples).sort()).toEqual(Object.keys(idFields).sort())
    for (const sample of Object.values(samples)) {
      expect(idCarrying(sample).sort()).toEqual(Object.keys(fieldRoles[sample.name] ?? {}).sort())
    }
  })

  for (const sample of Object.values(samples)) {
    it(`accepts ${sample.name} when each id it carries is in the original or created in this run`, () => {
      expectUntouched(deck(), (parts) => expect(() => exportElements(parts, [slideAdd(slideC), sample])).not.toThrow())
    })

    for (const field of idCarrying(sample)) {
      it(`refuses every id ${sample.name}.${field} could wrongly carry and writes nothing`, () => {
        const role = fieldRoles[sample.name]?.[field]
        if (role === undefined) throw new Error(`no role for ${sample.name}.${field}`)
        for (const [value, error] of refused[role]) {
          expectRefused([slideAdd(slideC), { ...sample, [field]: value } as ElementEdit], error)
        }
      })
    }
  }

  it("refuses a slide add with no token, the old form", () => {
    expectRefused([{ name: "sldIdLst.add", after: "256" } as unknown as ElementEdit], /edit/)
  })

  it("refuses an id field the table does not list", () => {
    expectRefused([{ ...samples.text, before: "256.2" } as ElementEdit], /edit/)
  })

  it("refuses an edit kind the table does not list", () => {
    expectRefused([{ name: "spTree.clone", id: "256.2" } as unknown as ElementEdit], /edit/)
  })

  it("refuses a created slide after a number this run wrote, in either array order", () => {
    const parts = deck()
    expect(exportElements(parts, [slideAdd(slideA)]).ids.slides.get(slideA)).toBe("257")
    expectRefused([slideAdd(slideA), slideAdd(slideB, "257")], /slide/)
  })

  it("refuses a created slide after a number kept from an earlier export, in either array order", () => {
    const earlier = exportElements(deck(), [slideAdd(slideA), add(`${slideA}.${shapeA}`, "ALPHA")])
    const kept = earlier.ids.slides.get(slideA)
    expect(kept).toBe("257")
    expectRefused([slideAdd(slideC), slideAdd(slideB, kept)], /slide/)
  })

  it("refuses a numeric shape from another slide of the original", () => {
    expectRefused([setText("256.8", "NO")], /shape/, wideDeck)
    expectRefused([setText("257.2", "NO")], /shape/, wideDeck)
  })

  it("refuses a numeric shape this run would create", () => {
    expectRefused([add(`256.${shapeA}`, "X"), { id: "256.3", name: "remove" }], /shape/)
  })

  it("refuses two creates for one id with different content", () => {
    expectRefused(
      [slideAdd(slideA), add(`${slideA}.${shapeA}`, "FIRST"), add(`${slideA}.${shapeA}`, "SECOND")],
      /shape/,
    )
  })

  it("refuses two creates for one id with the same content", () => {
    expectRefused([add(`256.${shapeA}`, "SAME"), add(`256.${shapeA}`, "SAME")], /shape/)
  })

  it("refuses two creates for one slide token", () => {
    expectRefused([slideAdd(slideA), slideAdd(slideA, "256")], /slide/)
  })

  it("refuses a shape on a slide token nothing created", () => {
    expectRefused([add(`${slideA}.${shapeA}`, "ALPHA")], /slide/)
  })

  it("refuses created slides that follow each other in a circle", () => {
    expectRefused([slideAdd(slideA, slideB), slideAdd(slideB, slideA)], /slide/)
    expectRefused([slideAdd(slideA, slideA)], /slide/)
  })

  it("treats two ids whose slides share one part and one token as one element", () => {
    const parts = wideDeck()
    const written = exportElements(parts, [add(`256.${shapeA}`, "ALPHA"), setText(`300.${shapeA}`, "ALPHA2")])
    expect(rowsFor(written.parts, "ALPHA")).toHaveLength(0)
    expect(rowsFor(written.parts, "ALPHA2")).toHaveLength(1)
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(written.parts))).toEqual([])
  })

  it("refuses creating one element under two ids whose slides share one part", () => {
    expectRefused([add(`256.${shapeA}`, "ALPHA"), add(`300.${shapeA}`, "BETA")], /shape/, wideDeck)
  })
})

describe("exportElements", () => {
  it("puts each created shape on the slide that was written for it", () => {
    const parts = deck()
    const kept = parts.get("ppt/media/keep.bin")
    const written = exportElements(parts, [
      slideAdd(slideA),
      slideAdd(slideB),
      add(`${slideA}.${shapeA}`, "ALPHA"),
      add(`${slideB}.${shapeB}`, "BETA"),
    ])
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
    expect(parts.has("ppt/slides/slide2.xml")).toBe(false)
  })

  it("lands a shape on its own slide when another created slide whose token sorts first took the next number", () => {
    const written = exportElements(deck(), [
      add(`${slideA}.${shapeA}`, "ALPHA"),
      slideAdd(slideA),
      slideAdd(slideFirst),
    ])
    const alpha = rowsFor(written.parts, "ALPHA")
    expect(written.ids.slides.get(slideFirst)).toBe("257")
    expect(written.ids.slides.get(slideA)).toBe("258")
    expect(alpha).toHaveLength(1)
    expect(alpha[0]).toMatchObject({ slide: "258", shape: "2", part: "ppt/slides/slide3.xml" })
    expect(decodeUtf8(written.parts.get("ppt/slides/slide2.xml") ?? text(""))).not.toContain("ALPHA")
  })

  it("writes a created slide after a created slide whose token sorts later", () => {
    const edits = [slideAdd(slideA, slideB), slideAdd(slideB)]
    const written = exportElements(deck(), edits)
    expect(written.ids.slides.get(slideB)).toBe("257")
    expect(written.ids.slides.get(slideA)).toBe("258")
    const order = [...decodeUtf8(written.parts.get("ppt/presentation.xml") ?? text("")).matchAll(/sldId id="(\d+)"/g)]
    expect(order.map((match) => match[1])).toEqual(["256", "257", "258"])
    expect(sameParts(exportElements(deck(), [...edits].reverse()).parts, written.parts)).toBe(true)
  })

  it("writes one shape for one token and distinct numbers for distinct tokens", () => {
    const parts = deck()
    const written = exportElements(parts, [
      add(`256.${shapeA}`, "ALPHA"),
      add(`256.${shapeB}`, "BETA"),
      setText(`256.${shapeA}`, "ALPHA2"),
    ])
    const alpha = rowsFor(written.parts, "ALPHA2")
    const beta = rowsFor(written.parts, "BETA")
    expect(rowsFor(written.parts, "ALPHA")).toHaveLength(0)
    expect(alpha).toHaveLength(1)
    expect(beta).toHaveLength(1)
    expect(alpha[0]).toMatchObject({ slide: "256", shape: "3" })
    expect(beta[0]).toMatchObject({ slide: "256", shape: "4" })
    expect(alpha[0]?.part).toBe("ppt/slides/slide1.xml")
    expect(beta[0]?.part).toBe(alpha[0]?.part)
    expect(newDuplicateShapeIds(shapeIdCounts(parts), shapeIdCounts(written.parts))).toEqual([])
  })

  it("edits a numeric shape on the slide part of the original it names", () => {
    const written = exportElements(wideDeck(), [setText("257.8", "CHANGED")])
    expect(rowsFor(written.parts, "CHANGED")[0]).toMatchObject({ slide: "257", shape: "8" })
    expect(rowsFor(written.parts, "One")).toHaveLength(1)
  })

  it("the same edit list gives the same bytes", async () => {
    const edits = [
      slideAdd(slideA),
      add(`${slideA}.${shapeA}`, "ALPHA"),
      setText("256.2", "FIRST"),
      { id: "256.2", name: "move", x: 5, y: 6 } as const,
    ]
    const once = await exportPackage(exportElements(deck(), edits).parts)
    const twice = await exportPackage(exportElements(deck(), edits).parts)
    expect(sameBytes(once, twice)).toBe(true)
  })

  it("reordering the creates changes nothing", () => {
    const creates: readonly ElementEdit[] = [
      slideAdd(slideFirst),
      slideAdd(slideA),
      slideAdd(slideB, slideA),
      add(`${slideA}.${shapeA}`, "ALPHA"),
      add(`${slideB}.${shapeB}`, "BETA"),
      add(`256.${shapeA}`, "GAMMA"),
      add(`256.${shapeB}`, "DELTA"),
    ]
    const others: readonly ElementEdit[] = [
      setText("256.2", "FIRST"),
      setText(`${slideA}.${shapeA}`, "ALPHA2"),
      setText("256.2", "SECOND"),
      { id: `256.${shapeA}`, name: "move", x: 5, y: 6 },
    ]
    const expected = exportElements(deck(), [...creates, ...others])
    fc.assert(
      fc.property(
        fc.shuffledSubarray([...creates], { minLength: creates.length }),
        fc.array(fc.nat(others.length), { minLength: creates.length, maxLength: creates.length }),
        (order, places) => {
          const list = [...others]
          order.forEach((edit, index) => list.splice(Math.min(places[index] ?? 0, list.length), 0, edit))
          const written = exportElements(deck(), list)
          expect(sameParts(written.parts, expected.parts)).toBe(true)
          expect([...written.ids.slides]).toEqual([...expected.ids.slides])
          expect([...written.ids.shapes].sort()).toEqual([...expected.ids.shapes].sort())
        },
      ),
      { numRuns: 30 },
    )
  })

  it("Text A then text B is a different list from B then A; the document's commit order orders them", () => {
    const first = exportElements(deck(), [setText("256.2", "AAA"), setText("256.2", "BBB")])
    const second = exportElements(deck(), [setText("256.2", "BBB"), setText("256.2", "AAA")])
    expect(rowsFor(first.parts, "BBB")).toHaveLength(1)
    expect(rowsFor(first.parts, "AAA")).toHaveLength(0)
    expect(rowsFor(second.parts, "AAA")).toHaveLength(1)
    expect(rowsFor(second.parts, "BBB")).toHaveLength(0)
  })

  it("Text then remove is a different list from remove then text; the document's commit order orders them", () => {
    const remove: ElementEdit = { id: "256.2", name: "remove" }
    const written = exportElements(deck(), [setText("256.2", "AAA"), remove])
    expect(rowsFor(written.parts, "AAA")).toHaveLength(0)
    const parts = deck()
    const held = parts.get("ppt/slides/slide1.xml")
    expect(() => exportElements(parts, [remove, setText("256.2", "AAA")])).toThrow(/shape/)
    expect(parts.get("ppt/slides/slide1.xml")).toBe(held)
  })

  it("rejects a created shape that was written onto another slide", () => {
    const before = deck()
    const written = exportElements(before, [
      slideAdd(slideFirst),
      slideAdd(slideA),
      slideAdd(slideB),
      add(`${slideA}.${shapeA}`, "ALPHA"),
      add(`${slideB}.${shapeB}`, "BETA"),
    ])
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
    const firstSlidePart = "ppt/slides/slide2.xml"
    const onFirst = new Map(written.parts)
    onFirst.set(firstSlidePart, alphaBytes)
    onFirst.set(alpha.part, wrong.get(firstSlidePart) ?? text(""))
    expect(touchMatches(before, onFirst, touch)).toBe(true)
    expect(createdShapesLanded(onFirst, landed, untouched)).toBe(false)
  })
})

import { describe, expect, it } from "vitest"
import {
  danglingShapeReferences,
  newDanglingShapeReferences,
  newDuplicateShapeIds,
  nextShapeId,
  shapeIdCounts,
} from "./shape-id.js"

function ascii(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

describe("newDuplicateShapeIds", () => {
  it("ignores an id that was already duplicated in that part", () => {
    const original = [{ part: "ppt/slides/slide1.xml", id: "2", count: 2 }]
    const edited = [{ part: "ppt/slides/slide1.xml", id: "2", count: 2 }]
    expect(newDuplicateShapeIds(original, edited)).toEqual([])
  })

  it("flags an id that becomes duplicated", () => {
    const original = [{ part: "ppt/slides/slide1.xml", id: "2", count: 1 }]
    const edited = [{ part: "ppt/slides/slide1.xml", id: "2", count: 2 }]
    expect(newDuplicateShapeIds(original, edited)).toEqual([{ part: "ppt/slides/slide1.xml", id: "2" }])
  })

  it("does not treat the same id on another part as the old duplicate", () => {
    const original = [{ part: "ppt/slides/slide1.xml", id: "2", count: 2 }]
    const edited = [{ part: "ppt/notesSlides/notesSlide1.xml", id: "2", count: 2 }]
    expect(newDuplicateShapeIds(original, edited)).toEqual([{ part: "ppt/notesSlides/notesSlide1.xml", id: "2" }])
  })
})

describe("shapeIdCounts", () => {
  it("counts cNvPr ids on slide parts and skips other parts", () => {
    const parts = new Map<string, Uint8Array>([
      ["ppt/slides/slide1.xml", ascii(`<p:cNvPr id="2"/><p:cNvPr id="2"/><p:cNvPrExtra id="9"/>`)],
      ["ppt/charts/chart1.xml", ascii(`<p:cNvPr id="3"/>`)],
      ["ppt/notesSlides/notesSlide1.xml", ascii(`<p:cNvPr id="4"/>`)],
      ["ppt/slides/not-a-slide.txt", ascii(`<p:cNvPr id="5"/>`)],
    ])
    expect(shapeIdCounts(parts)).toEqual([
      { part: "ppt/slides/slide1.xml", id: "2", count: 2 },
      { part: "ppt/notesSlides/notesSlide1.xml", id: "4", count: 1 },
    ])
  })
})

describe("nextShapeId", () => {
  it("returns one past the highest numeric id in the part", () => {
    expect(nextShapeId(`<p:cNvPr id="2"/><p:cNvPr id="7"/><p:cNvPr id="abc"/>`)).toBe(8)
    expect(nextShapeId("<p:spTree></p:spTree>")).toBe(1)
    expect(nextShapeId(`<p:cNvPrExtra id="9"/>`)).toBe(1)
  })

  it("refuses an id past the drawing element range", () => {
    expect(() => nextShapeId(`<p:cNvPr id="4294967295"/>`)).toThrow(/shape id/)
  })
})

describe("danglingShapeReferences", () => {
  const part = "ppt/slides/slide1.xml"
  const slide = (references: string) => new Map([[part, ascii(`<p:sld><p:cNvPr id="2"/>${references}</p:sld>`)]])

  it.each(["p:spTgt", "p:inkTgt", "p:bldP", "p:bldDgm", "p:bldOleChart", "p:bldGraphic"])(
    "lists a %s spid that names no shape",
    (kind) => {
      expect(danglingShapeReferences(slide(`<${kind} spid="9"/>`))).toEqual([{ part, kind, id: "9" }])
    },
  )

  it.each(["a:stCxn", "a:endCxn"])("lists a %s id that names no shape", (kind) => {
    expect(danglingShapeReferences(slide(`<${kind} id="9" idx="0"/>`))).toEqual([{ part, kind, id: "9" }])
  })

  it("passes references that name a shape on the part", () => {
    expect(danglingShapeReferences(slide(`<p:spTgt spid="2"/><p:bldP spid="2"/><a:stCxn id="2"/>`))).toEqual([])
  })

  it("does not take a shape on another part as the target", () => {
    const parts = new Map([
      [part, ascii(`<p:sld><p:spTgt spid="2"/></p:sld>`)],
      ["ppt/slides/slide2.xml", ascii(`<p:sld><p:cNvPr id="2"/></p:sld>`)],
    ])
    expect(danglingShapeReferences(parts)).toEqual([{ part, kind: "p:spTgt", id: "2" }])
  })

  it("ignores a p:oleObj spid, a p:subSp spid and parts that hold no shapes", () => {
    const parts = slide(`<p:oleObj spid="_x0000_s1026"/><p:subSp spid="9"/>`)
    parts.set("ppt/charts/chart1.xml", ascii(`<p:spTgt spid="9"/>`))
    expect(danglingShapeReferences(parts)).toEqual([])
  })
})

describe("newDanglingShapeReferences", () => {
  const part = "ppt/slides/slide1.xml"
  const planted = (references: string) =>
    danglingShapeReferences(new Map([[part, ascii(`<p:sld><p:cNvPr id="2"/>${references}</p:sld>`)]]))

  it("catches a hand-planted dangling spid", () => {
    expect(newDanglingShapeReferences(planted(""), planted(`<p:spTgt spid="9"/>`))).toEqual([
      { part, kind: "p:spTgt", id: "9" },
    ])
  })

  it("catches a hand-planted dangling stCxn", () => {
    expect(newDanglingShapeReferences(planted(""), planted(`<a:stCxn id="9" idx="0"/>`))).toEqual([
      { part, kind: "a:stCxn", id: "9" },
    ])
  })

  it("does not blame a reference that already dangled before the edit", () => {
    const already = planted(`<p:spTgt spid="9"/><a:stCxn id="8"/>`)
    expect(newDanglingShapeReferences(already, already)).toEqual([])
  })

  it("still blames a new kind of reference to an id that already dangled", () => {
    expect(newDanglingShapeReferences(planted(`<p:spTgt spid="9"/>`), planted(`<a:stCxn id="9"/>`))).toEqual([
      { part, kind: "a:stCxn", id: "9" },
    ])
  })

  it("does not treat the same reference on another part as the old one", () => {
    const other = "ppt/slides/slide2.xml"
    const edited = [{ part: other, kind: "p:spTgt", id: "9" }]
    expect(newDanglingShapeReferences([{ part, kind: "p:spTgt", id: "9" }], edited)).toEqual(edited)
  })
})

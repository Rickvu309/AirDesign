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

describe("shape id forms", () => {
  it("counts every form of one id as the same shape", () => {
    const marks = ["5", "05", "+5", "&#53;", " 5 "].map((id) => `<p:cNvPr id="${id}"/>`).join("")
    expect(shapeIdCounts(new Map([["ppt/slides/slide1.xml", ascii(marks)]]))).toEqual([
      { part: "ppt/slides/slide1.xml", id: "5", count: 5 },
    ])
  })

  it("takes the next id past a signed, referenced or namespaced id", () => {
    expect(nextShapeId(`<p:cNvPr id="+7"/>`)).toBe(8)
    expect(nextShapeId(`<p:cNvPr id="&#55;"/>`)).toBe(8)
    expect(nextShapeId(`<p14:cNvPr id="9"/>`)).toBe(10)
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
  const slide = (references: string) =>
    new Map([[part, ascii(`<p:sld><p:cNvPr id="2"/><p:timing>${references}</p:timing></p:sld>`)]])

  it.each(["p:spTgt", "p:inkTgt", "p:bldP", "p:bldDgm", "p:bldOleChart", "p:bldGraphic", "p:subSp", "p14:bmkTgt"])(
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
      [part, ascii(`<p:sld><p:timing><p:spTgt spid="2"/></p:timing></p:sld>`)],
      ["ppt/slides/slide2.xml", ascii(`<p:sld><p:cNvPr id="2"/></p:sld>`)],
    ])
    expect(danglingShapeReferences(parts)).toEqual([{ part, kind: "p:spTgt", id: "2" }])
  })

  it("ignores a spid outside p:timing and parts that hold no shapes", () => {
    const parts = new Map([
      [part, ascii(`<p:sld><p:cNvPr id="2"/><p:oleObj spid="_x0000_s1026"/><p:control spid="9"/></p:sld>`)],
      ["ppt/charts/chart1.xml", ascii(`<p:timing><p:spTgt spid="9"/></p:timing>`)],
    ])
    expect(danglingShapeReferences(parts)).toEqual([])
  })

  it("finds a target inside p:timing held in mc:AlternateContent", () => {
    const timing = `<mc:AlternateContent><mc:Choice><p:timing><p:spTgt spid="9"/></p:timing></mc:Choice></mc:AlternateContent>`
    expect(danglingShapeReferences(new Map([[part, ascii(`<p:sld>${timing}</p:sld>`)]]))).toEqual([
      { part, kind: "p:spTgt", id: "9" },
    ])
  })

  it.each(["05", "+5", "&#53;", "&#x35;", " 5 ", "\t005\n"])("takes a target written %j as shape 5", (form) => {
    const parts = new Map([
      [part, ascii(`<p:sld><p:cNvPr id="5"/><p:timing><p:spTgt spid="${form}"/></p:timing></p:sld>`)],
    ])
    expect(danglingShapeReferences(parts)).toEqual([])
  })

  it.each(["05", "+5", "&#53;", " 5 "])("takes a shape written %j as the target of 5", (form) => {
    const parts = new Map([[part, ascii(`<p:sld><p:cNvPr id="${form}"/><a:stCxn id="5"/></p:sld>`)]])
    expect(danglingShapeReferences(parts)).toEqual([])
  })

  it("reads -0 as zero, and leaves a negative number its own id", () => {
    const parts = new Map([[part, ascii(`<p:sld><p:cNvPr id="0"/><a:stCxn id="-0"/><a:endCxn id="-5"/></p:sld>`)]])
    expect(danglingShapeReferences(parts)).toEqual([{ part, kind: "a:endCxn", id: "-5" }])
  })

  it("keeps an id that is not an unsigned integer as its decoded string", () => {
    const parts = new Map([
      [part, ascii(`<p:sld><p:cNvPr id="ab"/><a:stCxn id="&#97;b"/><a:endCxn id="0ab"/></p:sld>`)],
    ])
    expect(danglingShapeReferences(parts)).toEqual([{ part, kind: "a:endCxn", id: "0ab" }])
  })

  it("names the row by the one identity whatever form the reference used", () => {
    expect(danglingShapeReferences(slide(`<p:spTgt spid="+009"/>`))).toEqual([{ part, kind: "p:spTgt", id: "9" }])
  })

  it("counts a cNvPr in any namespace as a shape", () => {
    const parts = new Map([[part, ascii(`<p:sld><p14:cNvPr id="5"/><p:timing><p:spTgt spid="5"/></p:timing></p:sld>`)]])
    expect(danglingShapeReferences(parts)).toEqual([])
  })

  it("does not count an element whose name only ends in cNvPr", () => {
    const parts = new Map([[part, ascii(`<p:sld><p:xcNvPr id="5"/><a:stCxn id="5"/></p:sld>`)]])
    expect(danglingShapeReferences(parts)).toEqual([{ part, kind: "a:stCxn", id: "5" }])
  })
})

describe("newDanglingShapeReferences", () => {
  const part = "ppt/slides/slide1.xml"
  const planted = (references: string) =>
    danglingShapeReferences(
      new Map([[part, ascii(`<p:sld><p:cNvPr id="2"/><p:timing>${references}</p:timing></p:sld>`)]]),
    )

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

  it("counts repeats, so one before and two after is one new row", () => {
    const one = planted(`<p:spTgt spid="9"/>`)
    const two = planted(`<p:spTgt spid="9"/><p:spTgt spid="9"/>`)
    expect(newDanglingShapeReferences(one, two)).toEqual([{ part, kind: "p:spTgt", id: "9" }])
    expect(newDanglingShapeReferences(two, one)).toEqual([])
    expect(newDanglingShapeReferences(planted(""), two)).toHaveLength(2)
  })

  it("does not call a reference new because its id was rewritten in another form", () => {
    expect(newDanglingShapeReferences(planted(`<p:spTgt spid="9"/>`), planted(`<p:spTgt spid="09"/>`))).toEqual([])
  })

  it("does not treat the same reference on another part as the old one", () => {
    const other = "ppt/slides/slide2.xml"
    const edited = [{ part: other, kind: "p:spTgt", id: "9" }]
    expect(newDanglingShapeReferences([{ part, kind: "p:spTgt", id: "9" }], edited)).toEqual(edited)
  })
})

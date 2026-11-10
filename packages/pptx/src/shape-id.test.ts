import { describe, expect, it } from "vitest"
import { newDuplicateShapeIds, nextShapeId, shapeIdCounts } from "./shape-id.js"

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

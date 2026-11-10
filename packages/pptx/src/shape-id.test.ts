import { describe, expect, it } from "vitest"
import { newDuplicateShapeIds } from "./shape-id.js"

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

import { describe, expect, it } from "vitest"
import { elementId, slideId, slideMeasure, type IndexElement, type SlideCommand } from "./index.js"

const box = { x: 0, y: 0, cx: 10, cy: 10 }
const size = { width: 9144000, height: 6858000 }
const index = {
  total: 0,
  slides: [
    { id: "256", position: 0, size, free: 9, animated: ["4"] },
    { id: "257", position: 1, size, free: 5, animated: [] },
    { id: "258", position: 2 },
  ],
  elements: [],
  pages: [],
}
const floor: readonly IndexElement[] = [
  { node: elementId("300.2"), kind: "shape", value: "A", box, grouped: false },
  { node: elementId("300.6"), kind: "shape", value: "B", box, grouped: false },
]

describe("slide measure", () => {
  it("reads a file slide's free id, animated shapes and the deck's size", () => {
    expect(slideMeasure({ file: [], order: [], index }, slideId("256"))).toEqual({ size, free: 9, animated: ["4"] })
  })

  it("has no measure for a slide an older index did not measure", () => {
    expect(slideMeasure({ file: [], order: [], index }, slideId("258"))).toBeUndefined()
    expect(slideMeasure({ file: [], order: [] }, slideId("256"))).toBeUndefined()
  })

  it("keeps a clone's source animated shapes and the larger free id, and gives a blank slide its floor's", () => {
    const order: SlideCommand[] = [
      { slide: "clone", id: slideId("300"), source: slideId("256"), key: "a1" as never, floor },
      { slide: "add", id: slideId("301"), after: slideId("300"), layout: slideId("257"), key: "a2" as never },
    ]
    expect(slideMeasure({ file: [], order, index }, slideId("300"))).toEqual({ size, free: 9, animated: ["4"] })
    expect(slideMeasure({ file: [], order, index }, slideId("301"))).toEqual({ size, free: 2, animated: [] })
  })

  it("follows a clone of a clone to the file slide", () => {
    const order: SlideCommand[] = [
      { slide: "clone", id: slideId("300"), source: slideId("257"), key: "a1" as never, floor },
      { slide: "clone", id: slideId("301"), source: slideId("300"), key: "a2" as never },
    ]
    expect(slideMeasure({ file: [], order, index }, slideId("301"))?.free).toBe(7)
  })
})

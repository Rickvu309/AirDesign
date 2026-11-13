import { describe, expect, it } from "vitest"
import { changeSaid, type Named } from "./element-said.js"

const slide1 = "ppt/slides/slide1.xml"
const slide2 = "ppt/slides/slide2.xml"
const here = "Slide 1 of 2"
const there = "Slide 2 of 2"

function named(part: string, labels: readonly (readonly [string, string])[]): Named {
  return new Map(labels.map(([shape, label]) => [`${part}#${shape}`, label]))
}

const hello = named(slide1, [
  ["2", "Hello"],
  ["3", "Text box"],
])
const withNext = named(slide1, [
  ["2", "Hello"],
  ["3", "Text box"],
  ["9", "Next steps"],
])
const copy = named(slide2, [
  ["2", "Hello"],
  ["3", "Text box"],
])

describe("changeSaid", () => {
  it("says an element was added or deleted on the slide that is showing", () => {
    expect(changeSaid(hello, withNext, slide1, slide1, here)).toBe("Next steps added")
    expect(changeSaid(withNext, hello, slide1, slide1, here)).toBe("Next steps deleted")
  })

  it("says an undone add was deleted and an undone delete was added", () => {
    expect(changeSaid(withNext, hello, slide1, slide1, here)).toBe("Next steps deleted")
    expect(changeSaid(hello, withNext, slide1, slide1, here)).toBe("Next steps added")
  })

  it("says nothing when the delete is refused and the elements are unchanged", () => {
    expect(changeSaid(hello, hello, slide1, slide1, here)).toBeNull()
  })

  it("says the slide when a new slide replaces the one showing, even with no labels yet", () => {
    expect(changeSaid(hello, new Map(), slide1, slide2, there)).toBe(there)
    expect(changeSaid(hello, named(slide2, [["2", "Text box"]]), slide1, slide2, there)).toBe(there)
  })

  it("says the slide when a duplicate is shown, not that the original elements were deleted", () => {
    expect(changeSaid(hello, copy, slide1, slide2, there)).toBe(there)
  })

  it("says the slide now showing when a slide is deleted, not each of its elements", () => {
    expect(changeSaid(copy, hello, slide2, slide1, "Slide 1 of 1")).toBe("Slide 1 of 1")
  })

  it("says nothing about elements when the same slide moves and only its number changes", () => {
    expect(changeSaid(hello, hello, slide1, slide1, "Slide 3 of 4")).toBeNull()
  })

  it("says the slide when another slide is selected", () => {
    expect(changeSaid(hello, copy, slide1, slide2, "Slide 3 of 4")).toBe("Slide 3 of 4")
  })

  it("says the slide passed for an undo or redo that changes which slide is showing", () => {
    expect(changeSaid(hello, new Map(), slide1, slide2, "Slide 1 of 1")).toBe("Slide 1 of 1")
    expect(changeSaid(new Map(), hello, slide2, slide1, there)).toBe(there)
  })

  it("says nothing about another slide an agent adds or removes while this slide stays", () => {
    expect(changeSaid(hello, hello, slide1, slide1, "Slide 1 of 2")).toBeNull()
    expect(changeSaid(hello, hello, slide1, slide1, "Slide 1 of 1")).toBeNull()
  })

  it("still says an element an agent adds or deletes on the slide that is showing", () => {
    expect(changeSaid(hello, withNext, slide1, slide1, "Slide 1 of 2")).toBe("Next steps added")
    expect(changeSaid(withNext, hello, slide1, slide1, "Slide 1 of 1")).toBe("Next steps deleted")
  })

  it("says nothing on the first paint", () => {
    expect(changeSaid(new Map(), hello, null, slide1, "Slide 1 of 1")).toBeNull()
  })

  it("stays quiet when the slide changes and there is no slide name to say", () => {
    expect(changeSaid(hello, new Map(), slide1, slide2, null)).toBeNull()
    expect(changeSaid(hello, copy, slide1, null, null)).toBeNull()
  })
})

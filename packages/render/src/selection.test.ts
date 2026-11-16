import { elementId, type ElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import type { CanvasElement, CanvasSlide } from "./record.js"
import { focused, kept, leadOf, noSelection, picked, toggled, unitOf, type Selection } from "./selection.js"

const outer = elementId("7.9")
const inner = elementId("7.8")
const first = elementId("7.2")
const second = elementId("7.3")
const deep = elementId("7.5")
const loose = elementId("7.4")
const other = elementId("7.6")

function element(id: ElementId, group?: ElementId): CanvasElement {
  return {
    key: `ppt/slides/slide7.xml#${id}`,
    id,
    kind: "shape",
    box: null,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...(group === undefined ? {} : { group: { id: group, box: null } }),
  }
}

function slideOf(elements: readonly CanvasElement[]): CanvasSlide {
  return { width: 12_192_000, height: 6_858_000, background: null, elements }
}

const slide = slideOf([
  element(outer),
  element(first, outer),
  element(second, outer),
  element(inner, outer),
  element(deep, inner),
  element(loose),
  element(other),
])

const many = (...ids: readonly ElementId[]): Selection => ({ ids, inside: null })

describe("a click", () => {
  it("picks the group a pressed child is in, the outer one first", () => {
    expect(picked(slide, noSelection, first)).toEqual({ ids: [outer], inside: null })
    expect(picked(slide, noSelection, deep)).toEqual({ ids: [outer], inside: null })
    expect(unitOf(slide, noSelection, deep)).toBe(outer)
  })

  it("steps into the selected group one level at a time", () => {
    const opened = picked(slide, many(outer), deep)
    expect(opened).toEqual({ ids: [inner], inside: outer })
    expect(picked(slide, opened, deep)).toEqual({ ids: [deep], inside: inner })
    expect(picked(slide, many(outer), first)).toEqual({ ids: [first], inside: outer })
  })

  it("picks a sibling inside an opened group and leaves the group for an element outside it", () => {
    const opened = { ids: [first], inside: outer }
    expect(picked(slide, opened, second)).toEqual({ ids: [second], inside: outer })
    expect(picked(slide, opened, loose)).toEqual({ ids: [loose], inside: null })
  })
})

describe("toggled", () => {
  it("adds an element with the same parent and takes it out on a second press", () => {
    const two = toggled(slide, many(loose), other)
    expect(two).toEqual({ ids: [loose, other], inside: null })
    expect(leadOf(two)).toBe(other)
    expect(toggled(slide, two, loose)).toEqual({ ids: [other], inside: null })
  })

  it("keeps one parent: a child of a closed group adds the group, and a press outside an opened group starts again", () => {
    expect(toggled(slide, many(loose), first)).toEqual({ ids: [loose, outer], inside: null })
    const opened = { ids: [first], inside: outer }
    expect(toggled(slide, opened, second)).toEqual({ ids: [first, second], inside: outer })
    expect(toggled(slide, opened, loose)).toEqual({ ids: [loose], inside: null })
  })
})

describe("focused", () => {
  it("makes a selected element the lead and selects one that was not selected alone", () => {
    expect(focused(slide, many(loose, other), loose)).toEqual({ ids: [other, loose], inside: null })
    expect(focused(slide, many(loose, other), first)).toEqual({ ids: [first], inside: outer })
  })
})

describe("kept", () => {
  it("drops a deleted id and keeps the rest", () => {
    const shown = slideOf(slide.elements.filter((each) => each.id !== other))
    expect(kept(many(loose, other), shown)).toEqual({ ids: [loose], inside: null })
  })

  it("keeps the same value while every element is still there", () => {
    const selection = many(loose, other)
    expect(kept(selection, slide)).toBe(selection)
  })

  it("leaves a group that is gone and keeps its children when an agent ungrouped it", () => {
    const ungrouped = slideOf([element(first), element(second), element(loose)])
    expect(kept({ ids: [first, second], inside: outer }, ungrouped)).toEqual({ ids: [first, second], inside: null })
  })

  it("drops elements an agent grouped, since they no longer share the selection's parent", () => {
    const grouped = slideOf([element(outer), element(loose, outer), element(other, outer)])
    expect(kept(many(loose, other), grouped)).toEqual(noSelection)
  })
})

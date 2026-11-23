import { elementId, type ElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import type { CanvasElement, CanvasSlide } from "./record.js"
import {
  allSelection,
  childrenSelection,
  deepPicked,
  deepToggled,
  focused,
  hoverTarget,
  kept,
  leadOf,
  noSelection,
  parentSelection,
  picked,
  steppedIn,
  toggled,
  unitOf,
  type Selection,
} from "./selection.js"

const outer = elementId("7.9")
const inner = elementId("7.8")
const backdrop = elementId("7.10")
const innerBackdrop = elementId("7.11")
const first = elementId("7.2")
const second = elementId("7.3")
const deep = elementId("7.5")
const loose = elementId("7.4")
const other = elementId("7.6")

function element(id: ElementId, group?: ElementId, overrides: Partial<CanvasElement> = {}): CanvasElement {
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
    ...overrides,
  }
}

function slideOf(elements: readonly CanvasElement[]): CanvasSlide {
  return { width: 12_192_000, height: 6_858_000, background: null, elements }
}

const slide = slideOf([
  element(outer, undefined, { kind: "group", frame: "auto", filled: false }),
  element(backdrop, outer, { backdrop: true }),
  element(first, outer),
  element(second, outer),
  element(inner, outer, { kind: "group", filled: false }),
  element(deep, inner),
  element(loose),
  element(other),
])

const many = (...ids: readonly ElementId[]): Selection => ({ ids, inside: null })

describe("a click", () => {
  it("picks the group a pressed child is in, the outer one first, and keeps it on a single click", () => {
    expect(picked(slide, noSelection, first)).toEqual({ ids: [outer], inside: null })
    expect(picked(slide, noSelection, deep)).toEqual({ ids: [outer], inside: null })
    expect(picked(slide, many(outer), first)).toEqual({ ids: [outer], inside: null })
    expect(picked(slide, noSelection, backdrop)).toEqual({ ids: [outer], inside: null })
    expect(unitOf(slide, noSelection, deep)).toBe(outer)
  })

  it("steps into a group one level at a time on double-click and ignores backdrops", () => {
    const opened = steppedIn(slide, many(outer), deep)
    expect(opened).toEqual({ ids: [inner], inside: outer })
    expect(steppedIn(slide, opened!, deep)).toEqual({ ids: [deep], inside: inner })
    expect(steppedIn(slide, { ids: [deep], inside: inner }, deep)).toBeNull()
    expect(steppedIn(slide, many(outer), first)).toEqual({ ids: [first], inside: outer })
    expect(steppedIn(slide, many(outer), backdrop)).toBeNull()
  })

  it("picks a sibling inside an opened group and leaves the group for an element outside it", () => {
    const opened = { ids: [first], inside: outer }
    expect(picked(slide, opened, second)).toEqual({ ids: [second], inside: outer })
    expect(picked(slide, opened, loose)).toEqual({ ids: [loose], inside: null })
  })
})

describe("layers that name their top group and their own parent, as the canvas paints them", () => {
  const painted = slideOf([
    element(outer, undefined, { kind: "group", frame: "auto", filled: false }),
    element(backdrop, outer, { backdrop: true, parent: outer }),
    element(first, outer, { parent: outer }),
    element(inner, outer, { kind: "group", frame: "auto", filled: false, parent: outer }),
    element(innerBackdrop, outer, { backdrop: true, parent: inner }),
    element(deep, outer, { parent: inner }),
    element(second, outer, { parent: inner }),
  ])

  it("steps in one level at a time, so a double-click on a nested leaf picks the inner frame first", () => {
    expect(picked(painted, noSelection, deep)).toEqual({ ids: [outer], inside: null })
    const opened = steppedIn(painted, many(outer), deep)
    expect(opened).toEqual({ ids: [inner], inside: outer })
    expect(steppedIn(painted, opened!, deep)).toEqual({ ids: [deep], inside: inner })
  })

  it("resolves a press on the inner frame's backdrop to the frame at the selection's level", () => {
    expect(unitOf(painted, noSelection, innerBackdrop)).toBe(outer)
    expect(unitOf(painted, { ids: [inner], inside: outer }, innerBackdrop)).toBe(inner)
  })
})

describe("deep select", () => {
  it("deep-picks the leaf directly and resolves a backdrop to its frame", () => {
    expect(deepPicked(slide, deep)).toEqual({ ids: [deep], inside: inner })
    expect(deepPicked(slide, first)).toEqual({ ids: [first], inside: outer })
    expect(deepPicked(slide, backdrop)).toEqual({ ids: [outer], inside: null })
    expect(deepPicked(slide, loose)).toEqual({ ids: [loose], inside: null })
  })

  it("deep-toggles across groups and collapses back when one parent remains", () => {
    const mixed = deepToggled(slide, many(loose), deep)
    expect(mixed).toEqual({ ids: [loose, deep], inside: null, acrossGroups: true })
    expect(deepToggled(slide, mixed, loose)).toEqual({ ids: [deep], inside: inner })
    expect(deepToggled(slide, { ids: [first], inside: outer }, second)).toEqual({
      ids: [first, second],
      inside: outer,
    })
  })
})

describe("hierarchy traversal", () => {
  it("steps up to the parent group and returns null at the top level", () => {
    expect(parentSelection(slide, { ids: [deep], inside: inner })).toEqual({ ids: [inner], inside: outer })
    expect(parentSelection(slide, { ids: [inner], inside: outer })).toEqual({ ids: [outer], inside: null })
    expect(parentSelection(slide, { ids: [outer], inside: null })).toBeNull()
    expect(parentSelection(slide, noSelection)).toBeNull()
  })

  it("selects direct non-backdrop children on Enter and returns null on leaf shapes", () => {
    expect(childrenSelection(slide, many(outer))).toEqual({ ids: [first, second, inner], inside: outer })
    expect(childrenSelection(slide, { ids: [inner], inside: outer })).toEqual({ ids: [deep], inside: inner })
    expect(childrenSelection(slide, many(loose))).toBeNull()
  })
})

describe("hoverTarget", () => {
  it("resolves the hovered layer like click or deep select and hides already-selected layers", () => {
    expect(hoverTarget(slide, noSelection, deep, false)).toBe(outer)
    expect(hoverTarget(slide, noSelection, deep, true)).toBe(deep)
    expect(hoverTarget(slide, noSelection, backdrop, true)).toBe(outer)
    expect(hoverTarget(slide, many(outer), deep, false)).toBeNull()
    expect(hoverTarget(slide, many(outer), deep, true)).toBe(deep)
    expect(hoverTarget(slide, { ids: [first], inside: outer }, second, false)).toBe(second)
    expect(hoverTarget(slide, { ids: [first], inside: outer }, first, false)).toBeNull()
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
  it("makes a selected element the lead, keeps an enclosing selected group, and selects an unselected element alone", () => {
    expect(focused(slide, many(loose, other), loose)).toEqual({ ids: [other, loose], inside: null })
    expect(focused(slide, many(loose, other), first)).toEqual({ ids: [first], inside: outer })
    expect(focused(slide, many(outer), first)).toEqual({ ids: [outer], inside: null })
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

  it("keeps a layer the slide holds but does not paint, as a hidden layer picked in the layers panel", () => {
    const hidden = { ...slideOf(slide.elements.filter((each) => each.id !== other)), unpainted: [other] }
    const selection = many(loose, other)
    expect(kept(selection, hidden)).toBe(selection)
    expect(kept(selection, slideOf(slide.elements.filter((each) => each.id !== other)))).toEqual({
      ids: [loose],
      inside: null,
    })
  })

  it("keeps a hidden layer inside a group selected with the group as its parent", () => {
    const hidden = { ...slideOf(slide.elements.filter((each) => each.id !== deep)), unpainted: [deep] }
    const selection = { ids: [deep], inside: outer }
    expect(kept(selection, hidden)).toBe(selection)
  })

  it("drops elements an agent grouped, since they no longer share the selection's parent", () => {
    const grouped = slideOf([element(outer), element(loose, outer), element(other, outer)])
    expect(kept(many(loose, other), grouped)).toEqual(noSelection)
  })
})

describe("select all and select inverse", () => {
  const locked = elementId("7.11")
  const withLocked = slideOf([...slide.elements, element(locked, undefined, { locked: true })])

  it("selects every layer at the level of the selection, skipping backdrops and locked layers", () => {
    expect(allSelection(withLocked, noSelection)).toEqual({ ids: [outer, loose, other], inside: null })
    expect(allSelection(withLocked, many(loose))).toEqual({ ids: [outer, loose, other], inside: null })
    expect(allSelection(withLocked, { ids: [first], inside: outer })).toEqual({
      ids: [first, second, inner],
      inside: outer,
    })
  })
})

import { elementId, type ElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import type { CanvasElement, CanvasSlide, PaintBox } from "./record.js"
import { noSelection, type Selection } from "./selection.js"
import { boxIntersectsRect, marqueeHits, marqueeMoved, marqueeRect, marqueeSelection } from "./slide-marquee.js"

const box = (x: number, y: number, width: number, height: number, rotation = 0): PaintBox => ({
  x,
  y,
  width,
  height,
  rotation,
  flipH: false,
  flipV: false,
})

function shape(id: ElementId | null, placed: PaintBox | null, overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    key: `ppt/slides/slide1.xml#${id ?? "bg"}`,
    id,
    kind: "shape",
    box: placed,
    editable: false,
    movable: true,
    placeholder: false,
    filled: true,
    fill: null,
    line: null,
    outline: "box",
    text: null,
    ...overrides,
  }
}

const a = elementId("256.2")
const b = elementId("256.3")
const c = elementId("256.4")
const group = elementId("256.9")
const inner = elementId("256.8")
const backdrop = elementId("256.10")
const child1 = elementId("256.11")
const child2 = elementId("256.12")
const deep = elementId("256.13")

describe("marquee geometry", () => {
  it("normalizes drags in all four directions", () => {
    const expected = { left: 10, top: 20, right: 110, bottom: 70 }
    expect(marqueeRect({ x: 10, y: 20 }, { x: 110, y: 70 })).toEqual(expected)
    expect(marqueeRect({ x: 110, y: 70 }, { x: 10, y: 20 })).toEqual(expected)
    expect(marqueeRect({ x: 110, y: 20 }, { x: 10, y: 70 })).toEqual(expected)
    expect(marqueeRect({ x: 10, y: 70 }, { x: 110, y: 20 })).toEqual(expected)
  })

  it("activates only once the pointer passes the drag threshold", () => {
    expect(marqueeMoved({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false)
    expect(marqueeMoved({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false)
    expect(marqueeMoved({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(true)
  })
})

describe("boxIntersectsRect", () => {
  it("hits touched and fully enclosed upright boxes and misses disjoint ones", () => {
    const target = box(100, 100, 200, 100)
    expect(boxIntersectsRect(target, { left: 50, top: 50, right: 105, bottom: 105 })).toBe(true)
    expect(boxIntersectsRect(target, { left: 0, top: 0, right: 400, bottom: 300 })).toBe(true)
    expect(boxIntersectsRect(target, { left: 150, top: 120, right: 160, bottom: 130 })).toBe(true)
    expect(boxIntersectsRect(target, { left: 300, top: 200, right: 320, bottom: 220 })).toBe(true)
    expect(boxIntersectsRect(target, { left: 301, top: 100, right: 400, bottom: 200 })).toBe(false)
    expect(boxIntersectsRect(target, { left: 100, top: 201, right: 200, bottom: 300 })).toBe(false)
  })

  it("hits zero-thickness horizontal and vertical lines when crossed", () => {
    const horizontal = box(100, 200, 300, 0)
    expect(boxIntersectsRect(horizontal, { left: 150, top: 180, right: 200, bottom: 220 })).toBe(true)
    expect(boxIntersectsRect(horizontal, { left: 150, top: 201, right: 200, bottom: 220 })).toBe(false)
    const vertical = box(200, 100, 0, 300)
    expect(boxIntersectsRect(vertical, { left: 190, top: 150, right: 210, bottom: 200 })).toBe(true)
    expect(boxIntersectsRect(vertical, { left: 201, top: 150, right: 220, bottom: 200 })).toBe(false)
  })

  it("intersects a rotated layer's oriented box: hits rotated tips and misses empty AABB corners", () => {
    const diagonal = box(0, 40, 100, 20, 45)
    expect(boxIntersectsRect(diagonal, { left: 82, top: 82, right: 86, bottom: 86 })).toBe(true)
    expect(boxIntersectsRect(diagonal, { left: 14, top: 14, right: 18, bottom: 18 })).toBe(true)
    expect(boxIntersectsRect(diagonal, { left: 48, top: 48, right: 52, bottom: 52 })).toBe(true)
    expect(boxIntersectsRect(diagonal, { left: 88, top: 8, right: 95, bottom: 15 })).toBe(false)
    expect(boxIntersectsRect(diagonal, { left: 5, top: 85, right: 12, bottom: 92 })).toBe(false)

    const quarter = box(100, 140, 200, 20, 90)
    expect(boxIntersectsRect(quarter, { left: 195, top: 55, right: 205, bottom: 65 })).toBe(true)
    expect(boxIntersectsRect(quarter, { left: 105, top: 145, right: 120, bottom: 155 })).toBe(false)
  })
})

describe("marqueeHits", () => {
  const groupBox = box(400, 100, 300, 200)
  const slide: CanvasSlide = {
    width: 1_000,
    height: 600,
    background: null,
    elements: [
      shape(null, box(0, 0, 1_000, 600)),
      shape(a, box(50, 50, 100, 100)),
      shape(b, box(200, 50, 100, 100)),
      shape(c, box(50, 250, 100, 100), { box: box(50, 250, 100, 20, 45) }),
      shape(group, groupBox, { kind: "group", frame: "auto", filled: false }),
      shape(backdrop, groupBox, { group: { id: group, box: groupBox, frame: "auto" }, backdrop: true }),
      shape(child1, box(410, 110, 80, 80), { group: { id: group, box: groupBox, frame: "auto" } }),
      shape(child2, box(590, 190, 80, 80), { group: { id: group, box: groupBox, frame: "auto" } }),
      shape(inner, box(410, 210, 80, 80), { kind: "group", group: { id: group, box: groupBox }, filled: false }),
      shape(deep, box(420, 220, 60, 60), { group: { id: inner, box: box(410, 210, 80, 80) } }),
    ],
  }

  it("selects touched and enclosed top-level layers and groups as whole units, ignoring unselectable layers and backdrops", () => {
    expect(marqueeHits(slide, { left: 40, top: 40, right: 210, bottom: 160 }, { deep: false })).toEqual([a, b])
    expect(marqueeHits(slide, { left: 405, top: 105, right: 680, bottom: 290 }, { deep: false })).toEqual([group])
    expect(marqueeHits(slide, { left: 500, top: 140, right: 560, bottom: 180 }, { deep: false })).toEqual([group])
    expect(marqueeHits(slide, { left: 0, top: 0, right: 1_000, bottom: 600 }, { deep: false })).toEqual([
      a,
      b,
      c,
      group,
    ])
  })

  it("deep-selects leaf layers inside groups and frames while skipping groups and backdrops", () => {
    expect(marqueeHits(slide, { left: 405, top: 105, right: 500, bottom: 200 }, { deep: true })).toEqual([child1])
    expect(marqueeHits(slide, { left: 405, top: 105, right: 680, bottom: 290 }, { deep: true })).toEqual([
      child1,
      child2,
      deep,
    ])
    expect(marqueeHits(slide, { left: 510, top: 120, right: 570, bottom: 170 }, { deep: true })).toEqual([])
  })

  it("leaves a locked layer out, as a pointer passes through it", () => {
    const locking = (id: ElementId) => ({
      ...slide,
      elements: slide.elements.map((each) => (each.id === id ? { ...each, locked: true as const } : each)),
    })
    expect(marqueeHits(locking(b), { left: 40, top: 40, right: 210, bottom: 160 }, { deep: false })).toEqual([a])
    expect(marqueeHits(locking(group), { left: 405, top: 105, right: 680, bottom: 290 }, { deep: false })).toEqual([])
    expect(marqueeHits(locking(child2), { left: 405, top: 105, right: 680, bottom: 290 }, { deep: true })).toEqual([
      child1,
      deep,
    ])
  })

  it("uses live boxes when a resolver is supplied", () => {
    const moved = new Map<ElementId, PaintBox>([[a, box(800, 400, 100, 100)]])
    const resolveBox = (element: CanvasElement) => (element.id !== null ? (moved.get(element.id) ?? element.box) : null)
    expect(marqueeHits(slide, { left: 40, top: 40, right: 160, bottom: 160 }, { deep: false, resolveBox })).toEqual([])
    expect(marqueeHits(slide, { left: 790, top: 390, right: 820, bottom: 420 }, { deep: false, resolveBox })).toEqual([
      a,
    ])
  })
})

describe("marqueeSelection", () => {
  const groupBox = box(400, 100, 300, 200)
  const slide: CanvasSlide = {
    width: 1_000,
    height: 600,
    background: null,
    elements: [
      shape(a, box(50, 50, 100, 100)),
      shape(b, box(200, 50, 100, 100)),
      shape(group, groupBox, { kind: "group", filled: false }),
      shape(child1, box(410, 110, 80, 80), { group: { id: group, box: groupBox } }),
      shape(child2, box(590, 190, 80, 80), { group: { id: group, box: groupBox } }),
      shape(inner, box(410, 210, 80, 80), { kind: "group", group: { id: group, box: groupBox }, filled: false }),
      shape(deep, box(420, 220, 60, 60), { group: { id: inner, box: box(410, 210, 80, 80) } }),
    ],
  }

  it("replaces selection on a plain marquee and clears on zero hits", () => {
    const before: Selection = { ids: [a], inside: null }
    expect(marqueeSelection(slide, before, [b, group], false)).toEqual({ ids: [b, group], inside: null })
    expect(marqueeSelection(slide, before, [], false)).toEqual(noSelection)
  })

  it("adds hits on a Shift-marquee without duplicates and keeps prior selection on zero hits", () => {
    const before: Selection = { ids: [a, b], inside: null }
    expect(marqueeSelection(slide, before, [b, group], true)).toEqual({ ids: [a, b, group], inside: null })
    expect(marqueeSelection(slide, before, [], true)).toBe(before)
  })

  it("sets inside to the common parent for deep hits in one group and acrossGroups when parents differ", () => {
    expect(marqueeSelection(slide, noSelection, [child1, child2], false)).toEqual({
      ids: [child1, child2],
      inside: group,
    })
    expect(marqueeSelection(slide, noSelection, [a, child1], false)).toEqual({
      ids: [a, child1],
      inside: null,
      acrossGroups: true,
    })
    expect(marqueeSelection(slide, noSelection, [child1, deep], false)).toEqual({
      ids: [child1, deep],
      inside: null,
      acrossGroups: true,
    })
  })
})

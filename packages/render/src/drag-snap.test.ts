import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { snapTargets, snappedTransform, type DragSnap } from "./drag-snap.js"
import { paintStore } from "./store.js"
import { evaluateTransform, type TransformDragInput } from "./transform-drag.js"
import type { TransformGrip } from "./transform-math.js"

const slide = { width: 12_192_000, height: 6_858_000 }
const id = elementId("256.2")
const start = { x: 1_524_000, y: 1_524_000, cx: 3_048_000, cy: 1_524_000 }
const wall = { left: 4_876_800, top: 3_810_000, right: 6_096_000, bottom: 4_572_000 }
const shelf = { left: 9_144_000, top: start.y + 40_000, right: 10_668_000, bottom: 2_500_000 }
const snap: DragSnap = {
  layers: [wall, shelf],
  slide: { left: 0, top: 0, right: slide.width, bottom: slide.height },
  turns: new Map(),
}
const plain = { shiftKey: false, altKey: false, ctrlKey: false }

function dragged(grip: TransformGrip, by: { x: number; y: number }, modifiers = plain) {
  const from = { x: 400, y: 200 }
  const input: TransformDragInput = {
    grip,
    ids: [id],
    starts: new Map([[id, { box: start, rotation: 0 }]]),
    from,
    at: { x: from.x + by.x, y: from.y + by.y },
    width: 800,
    slide,
    modifiers,
    centerScreen: { x: 0, y: 0 },
  }
  return snappedTransform(input, evaluateTransform, snap)
}

describe("snappedTransform", () => {
  it("snaps a dragged right edge to another layer's left edge and keeps the height", () => {
    const result = dragged("right", { x: 18, y: 7 })
    expect(result.boxes.get(id)).toEqual({ ...start, cx: wall.left - start.x })
    expect(result.guides.length).toBeGreaterThan(0)
    expect(result.guides.every((guide) => guide.axis === "x")).toBe(true)
    expect(result.hud?.frame).toEqual({ ...start, cx: wall.left - start.x })
  })

  it("snaps a dragged bottom-right corner on both axes", () => {
    const result = dragged("bottom-right", { x: 18, y: 48 })
    expect(result.boxes.get(id)).toEqual({ ...start, cx: wall.left - start.x, cy: wall.top - start.y })
  })

  it("keeps a Shift move on its axis while it snaps along it", () => {
    const result = dragged("move", { x: 98, y: 3 }, { ...plain, shiftKey: true })
    expect(result.boxes.get(id)).toEqual({ ...start, x: wall.right - start.cx })
  })

  it("snaps a move on both axes without Shift", () => {
    const result = dragged("move", { x: 98, y: 0 })
    expect(result.boxes.get(id)).toEqual({ ...start, x: wall.right - start.cx, y: shelf.top })
  })
})

describe("snapTargets", () => {
  it("lines a slide's guides up by axis, so a drag snaps to them", () => {
    const store = paintStore()
    const targets = snapTargets(
      {
        width: slide.width,
        height: slide.height,
        background: null,
        elements: [],
        guides: [
          { axis: "x", offset: 914_400 },
          { axis: "y", offset: 457_200 },
          { axis: "x", offset: -12_700 },
        ],
      },
      store,
      [],
    )
    expect(targets.guides).toEqual({ x: [914_400, -12_700], y: [457_200] })
  })
})

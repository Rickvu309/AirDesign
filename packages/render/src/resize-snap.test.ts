import { elementId, type Box, type ElementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { snappedTransform, type DragSnap } from "./drag-snap.js"
import { around, boundsOf, type Bounds } from "./snapping.js"
import { evaluateTransform, type TransformDragInput, type TransformModifiers } from "./transform-drag.js"
import type { RotatedLayer, TransformGrip } from "./transform-math.js"

const slide = { width: 12_192_000, height: 6_858_000 }
const one = elementId("256.2")
const two = elementId("256.3")
const start = { x: 1_524_000, y: 1_524_000, cx: 3_048_000, cy: 1_524_000 }
const wall = { left: 4_876_800, top: 3_810_000, right: 6_096_000, bottom: 4_572_000 }
const shelf = { left: 9_144_000, top: start.y + 40_000, right: 10_668_000, bottom: 2_500_000 }
const post = { left: 4_100_000, top: 5_000_000, right: 4_500_000, bottom: 5_500_000 }
const plain: TransformModifiers = { shiftKey: false, altKey: false, ctrlKey: false }
const alt = { ...plain, altKey: true }
const shift = { ...plain, shiftKey: true }

type Drag = {
  readonly grip: TransformGrip
  readonly by: { readonly x: number; readonly y: number }
  readonly modifiers?: TransformModifiers
  readonly layers?: ReadonlyMap<ElementId, RotatedLayer>
  readonly targets?: readonly Bounds[]
}

function snapOf(layers: ReadonlyMap<ElementId, RotatedLayer>, targets: readonly Bounds[]): DragSnap {
  return {
    layers: targets,
    slide: { left: 0, top: 0, right: slide.width, bottom: slide.height },
    turns: new Map([...layers].map(([id, layer]) => [id, layer.rotation])),
  }
}

function dragged({ grip, by, modifiers = plain, layers, targets = [wall, shelf] }: Drag) {
  const starts = layers ?? new Map([[one, { box: start, rotation: 0 }]])
  const from = { x: 400, y: 200 }
  const input: TransformDragInput = {
    grip,
    ids: [...starts.keys()],
    starts,
    from,
    at: { x: from.x + by.x, y: from.y + by.y },
    width: 800,
    slide,
    modifiers,
    centerScreen: { x: 0, y: 0 },
  }
  return snappedTransform(input, evaluateTransform, snapOf(starts, targets))
}

function shownBounds(boxes: ReadonlyMap<ElementId, Box>, layers: ReadonlyMap<ElementId, RotatedLayer>): Bounds | null {
  return around([...boxes].map(([id, box]) => boundsOf(box, layers.get(id)?.rotation ?? 0)))
}

describe("snapping while resizing", () => {
  it("snaps a dragged top edge and leaves the sides where they were", () => {
    const result = dragged({ grip: "top", by: { x: 2, y: 3 } })
    expect(result.boxes.get(one)).toEqual({ ...start, y: shelf.top, cy: start.y + start.cy - shelf.top })
    expect(result.guides.length).toBeGreaterThan(0)
    expect(result.guides.every((guide) => guide.axis === "y")).toBe(true)
  })

  it("snaps a resize from the centre with Alt and moves the far edge by the same amount", () => {
    const result = dragged({ grip: "right", by: { x: 18, y: 0 }, modifiers: alt })
    const grown = wall.left - (start.x + start.cx)
    expect(result.boxes.get(one)).toEqual({ ...start, x: start.x - grown, cx: start.cx + 2 * grown })
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: "snap", axis: "x", at: wall.left }))
    expect(result.hud?.frame).toEqual(result.boxes.get(one))
  })

  it("snaps the far edge of a resize from the centre when that edge comes near a line", () => {
    const result = dragged({ grip: "left", by: { x: -18, y: 0 }, modifiers: alt })
    const grown = wall.left - (start.x + start.cx)
    expect(result.boxes.get(one)).toEqual({ ...start, x: start.x - grown, cx: start.cx + 2 * grown })
  })

  it("snaps a Shift edge resize and keeps the proportions about the middle", () => {
    const result = dragged({ grip: "right", by: { x: 18, y: 0 }, modifiers: shift })
    const cx = wall.left - start.x
    const cy = (cx * start.cy) / start.cx
    expect(result.boxes.get(one)).toEqual({ x: start.x, y: start.y + (start.cy - cy) / 2, cx, cy })
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: "snap", axis: "x", at: wall.left }))
  })

  it("snaps a Shift corner resize by its nearer edge and keeps the proportions", () => {
    const result = dragged({ grip: "bottom-right", by: { x: 18, y: 4 }, modifiers: shift })
    const cx = wall.left - start.x
    expect(result.boxes.get(one)).toEqual({ ...start, cx, cy: (cx * start.cy) / start.cx })
  })

  it("snaps the outermost point of a turned layer while one of its edges is dragged", () => {
    const layers = new Map([[one, { box: start, rotation: 90 }]])
    const result = dragged({ grip: "top", by: { x: 18, y: 0 }, layers, targets: [post] })
    const box = result.boxes.get(one)
    expect(box).toBeDefined()
    if (box === undefined) return
    expect(boundsOf(box, 90).right).toBeCloseTo(post.left, -1)
    expect(boundsOf(box, 90).left).toBeCloseTo(boundsOf(start, 90).left, -1)
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: "snap", axis: "x" }))
  })

  it("snaps a layer turned by an odd angle by the corner of its outermost points", () => {
    const layers = new Map([[one, { box: start, rotation: 30 }]])
    const turned = boundsOf(start, 30)
    const near = { left: turned.right + 20_000, top: 5_000_000, right: turned.right + 400_000, bottom: 5_500_000 }
    const result = dragged({ grip: "bottom-right", by: { x: 1, y: 0 }, layers, targets: [near] })
    const shown = shownBounds(result.boxes, layers)
    expect(shown?.right).toBeCloseTo(near.left, -1)
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: "snap", axis: "x" }))
  })

  it("snaps the frame of a multi-selection and scales every layer in it", () => {
    const below = { x: start.x, y: 3_352_800, cx: 1_524_000, cy: 762_000 }
    const layers = new Map([
      [one, { box: start, rotation: 0 }],
      [two, { box: below, rotation: 0 }],
    ])
    const result = dragged({ grip: "bottom-right", by: { x: 18, y: 0 }, layers })
    const scale = (wall.left - start.x) / start.cx
    expect(result.boxes.get(one)).toEqual({ ...start, cx: Math.round(start.cx * scale) })
    expect(result.boxes.get(two)).toEqual({ ...below, cx: Math.round(below.cx * scale) })
    expect(result.guides).toContainEqual(expect.objectContaining({ kind: "snap", axis: "x", at: wall.left }))
  })

  it("snaps only the edges a resize moves, never its moving centre", () => {
    const middle = start.x + (start.cx + 18 * 15_240) / 2
    const mark = { left: middle + 10_000, top: 5_000_000, right: middle + 400_000, bottom: 5_500_000 }
    const result = dragged({ grip: "right", by: { x: 18, y: 0 }, targets: [mark] })
    expect(result.boxes.get(one)).toEqual({ ...start, cx: start.cx + 18 * 15_240 })
    expect(result.guides).toEqual([])
  })

  it("leaves a resize alone when no line is within reach", () => {
    const result = dragged({ grip: "right", by: { x: 6, y: 0 }, modifiers: alt })
    expect(result.boxes.get(one)).toEqual({ ...start, x: start.x - 6 * 15_240, cx: start.cx + 12 * 15_240 })
    expect(result.guides).toEqual([])
  })
})

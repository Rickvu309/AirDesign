import type { Box, ElementId } from "@airdesign/document"
import { boxOf, emuOf, movedBoxes, ownBox } from "./box-gesture.js"
import type { CanvasElement, CanvasSlide } from "./record.js"
import {
  around,
  boundsOf,
  everyLine,
  guidesAt,
  reachOf,
  snapMove,
  type Bounds,
  type Guide,
  type SnapTargets,
} from "./snapping.js"
import { snappedResize, type Evaluate } from "./resize-snap.js"
import type { PaintStore } from "./store.js"
import type { TransformDragInput, TransformResult } from "./transform-drag.js"
import { constrainMove, isResizeGrip } from "./transform-math.js"

export type DragSnap = SnapTargets & { readonly turns: ReadonlyMap<ElementId, number> }

export type SnappedDrag = { readonly boxes: ReadonlyMap<ElementId, Box>; readonly guides: readonly Guide[] }

function lineage(parents: ReadonlyMap<ElementId, ElementId | null>, id: ElementId): readonly ElementId[] {
  const chain: ElementId[] = []
  let parent = parents.get(id) ?? null
  while (parent !== null && !chain.includes(parent)) {
    chain.push(parent)
    parent = parents.get(parent) ?? null
  }
  return chain
}

export function paintedBounds(element: CanvasElement, store: PaintStore): Bounds | null {
  if (element.id === null) return null
  const painted = ownBox(element, store.getBox(element.id), store.getRotation(element.id))
  return painted === null ? null : boundsOf(boxOf(painted), painted.rotation)
}

export function snapTargets(slide: CanvasSlide, store: PaintStore, moving: readonly ElementId[]): DragSnap {
  const parents = new Map(
    slide.elements.flatMap((each): [ElementId, ElementId | null][] =>
      each.id === null ? [] : [[each.id, each.group?.id ?? null]],
    ),
  )
  const held = new Set(moving)
  const holding = new Set(moving.flatMap((id) => lineage(parents, id)))
  const layers = slide.elements.flatMap((each): Bounds[] => {
    const id = each.id
    if (id === null || held.has(id) || holding.has(id)) return []
    if (lineage(parents, id).some((parent) => held.has(parent))) return []
    const bounds = paintedBounds(each, store)
    return bounds === null ? [] : [bounds]
  })
  const turns = new Map(
    slide.elements.flatMap((each): [ElementId, number][] =>
      each.id !== null && held.has(each.id) ? [[each.id, store.getRotation(each.id) ?? each.box?.rotation ?? 0]] : [],
    ),
  )
  const guides = slide.guides ?? []
  return {
    layers,
    slide: { left: 0, top: 0, right: slide.width, bottom: slide.height },
    guides: {
      x: guides.flatMap((guide) => (guide.axis === "x" ? [guide.offset] : [])),
      y: guides.flatMap((guide) => (guide.axis === "y" ? [guide.offset] : [])),
    },
    turns,
  }
}

function boundsAround(boxes: ReadonlyMap<ElementId, Box>, turns: ReadonlyMap<ElementId, number>): Bounds | null {
  return around([...boxes].map(([id, box]) => boundsOf(box, turns.get(id) ?? 0)))
}

function sameBounds(one: Bounds, two: Bounds): boolean {
  return (
    Math.abs(one.left - two.left) < 1 &&
    Math.abs(one.top - two.top) < 1 &&
    Math.abs(one.right - two.right) < 1 &&
    Math.abs(one.bottom - two.bottom) < 1
  )
}

function snappedMove(input: TransformDragInput, raw: ReadonlyMap<ElementId, Box>, snap: DragSnap): SnappedDrag {
  const moving = boundsAround(raw, snap.turns)
  if (moving === null) return { boxes: raw, guides: [] }
  const snapped = snapMove(moving, snap, reachOf(input.width, input.slide.width))
  const pulled = emuOf(input.at.x - input.from.x, input.width, input.slide)
  const pushed = emuOf(input.at.y - input.from.y, input.width, input.slide)
  const travel = constrainMove(pulled, pushed, input.modifiers.shiftKey)
  const lockedX = input.modifiers.shiftKey && travel.dx === 0
  const lockedY = input.modifiers.shiftKey && travel.dy === 0 && !lockedX
  const dx = travel.dx + (lockedX ? 0 : snapped.box.left - moving.left)
  const dy = travel.dy + (lockedY ? 0 : snapped.box.top - moving.top)
  const starts = new Map([...input.starts].map(([id, layer]) => [id, layer.box]))
  const boxes = movedBoxes(starts, dx, dy, input.slide)
  const placed = boundsAround(boxes, snap.turns)
  if (placed === null) return { boxes, guides: [] }
  return { boxes, guides: sameBounds(placed, snapped.box) ? snapped.guides : guidesAt(placed, snap, everyLine) }
}

export function snappedTransform(
  input: TransformDragInput,
  evaluate: Evaluate,
  snap: DragSnap | null,
): TransformResult & { readonly guides: readonly Guide[] } {
  const result = evaluate(input)
  if (snap === null) return { ...result, guides: [] }
  if (input.grip === "move") return { ...result, ...snappedMove(input, result.boxes, snap) }
  if (!isResizeGrip(input.grip)) return { ...result, guides: [] }
  return snappedResize(input, evaluate, snap)
}

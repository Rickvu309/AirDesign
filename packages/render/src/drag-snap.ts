import type { Box, ElementId } from "@airdesign/document"
import {
  boxOf,
  draggedBoxes,
  emuOf,
  minimumSide,
  movedBoxes,
  ownBox,
  type Corner,
  type Drag,
  type Point,
  type SlideSize,
} from "./box-gesture.js"
import type { CanvasSlide } from "./record.js"
import {
  around,
  boundsOf,
  everyLine,
  guidesAt,
  reachOf,
  snapMove,
  snapResize,
  type Axis,
  type Bounds,
  type Guide,
  type Side,
  type SnapTargets,
} from "./snapping.js"
import type { PaintStore } from "./store.js"

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
    const painted = ownBox(each, store.getBox(id))
    return painted === null ? [] : [boundsOf(boxOf(painted), painted.rotation)]
  })
  const turns = new Map(
    slide.elements.flatMap((each): [ElementId, number][] =>
      each.id !== null && held.has(each.id) ? [[each.id, each.box?.rotation ?? 0]] : [],
    ),
  )
  return { layers, slide: { left: 0, top: 0, right: slide.width, bottom: slide.height }, turns }
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

function snappedMove(drag: Drag, at: Point, width: number, slide: SlideSize, snap: DragSnap): SnappedDrag {
  const raw = draggedBoxes(drag, at, width, slide)
  const moving = boundsAround(raw, snap.turns)
  if (moving === null) return { boxes: raw, guides: [] }
  const snapped = snapMove(moving, snap, reachOf(width, slide.width))
  const dx = emuOf(at.x - drag.from.x, width, slide) + snapped.box.left - moving.left
  const dy = emuOf(at.y - drag.from.y, width, slide) + snapped.box.top - moving.top
  const boxes = movedBoxes(drag.starts, dx, dy, slide)
  const placed = boundsAround(boxes, snap.turns)
  if (placed === null) return { boxes, guides: [] }
  return { boxes, guides: sameBounds(placed, snapped.box) ? snapped.guides : guidesAt(placed, snap, everyLine) }
}

function sidesOf(corner: Corner): Readonly<Record<Axis, Side>> {
  return {
    x: corner === "top-left" || corner === "bottom-left" ? "start" : "end",
    y: corner === "top-left" || corner === "top-right" ? "start" : "end",
  }
}

function snappedResize(drag: Drag, corner: Corner, at: Point, width: number, slide: SlideSize, snap: DragSnap) {
  const raw = draggedBoxes(drag, at, width, slide)
  const [id] = drag.ids
  const box = id === undefined ? undefined : raw.get(id)
  const start = id === undefined ? undefined : drag.starts.get(id)
  if (id === undefined || box === undefined || start === undefined || (drag.rotation ?? 0) !== 0) {
    return { boxes: raw, guides: [] }
  }
  const reach = reachOf(width, slide.width)
  const snapped = snapResize(boundsOf(box), sidesOf(corner), snap, reach, drag.keepRatio === true)
  const next = {
    x: Math.round(snapped.box.left),
    y: Math.round(snapped.box.top),
    cx: Math.round(snapped.box.right - snapped.box.left),
    cy: Math.round(snapped.box.bottom - snapped.box.top),
  }
  if (next.cx < Math.min(minimumSide, start.cx) || next.cy < Math.min(minimumSide, start.cy)) {
    return { boxes: raw, guides: [] }
  }
  return { boxes: new Map([[id, next]]), guides: snapped.guides }
}

export function snappedDrag(
  drag: Drag,
  at: Point,
  width: number,
  slide: SlideSize,
  snap: DragSnap | null,
): SnappedDrag {
  if (snap === null) return { boxes: draggedBoxes(drag, at, width, slide), guides: [] }
  if (drag.grip === "move") return snappedMove(drag, at, width, slide, snap)
  return snappedResize(drag, drag.grip, at, width, slide, snap)
}

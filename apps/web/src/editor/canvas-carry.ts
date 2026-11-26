import * as doom from "@airdesign/doom"
import type { Preview } from "./canvas-overlay"
import { snapMove, type Bounds, type Guide, type SnapTargets } from "./snapping"
import { aroundPlaced, type Point, type SlideGeometry } from "./slide-geometry"

export type CarryOver =
  | { readonly kind: "home" }
  | { readonly kind: "none" }
  | {
      readonly kind: "slide"
      readonly slide: doom.NodeId
      readonly offset: Point
      readonly geometry: SlideGeometry | null
    }

export type GridCarry = {
  readonly over: (at: Point) => CarryOver
  readonly onCarry: (over: doom.NodeId | null | undefined) => void
  readonly edge: (client: Point) => boolean
  readonly landed: (slide: doom.NodeId, ids: readonly doom.NodeId[]) => void
}

export type Lift = {
  readonly copies: doom.Copies | null
  readonly roots: readonly doom.NodeId[]
  readonly boxes: ReadonlyMap<doom.NodeId, doom.Box>
  readonly from: Bounds
  readonly carried: ReadonlySet<doom.NodeId>
  readonly preview: Preview
}

export type Flight = {
  readonly carried: ReadonlySet<string>
  readonly by: Point
  readonly offset: Point
  readonly guides: readonly Guide[]
}

const author: doom.Author = { kind: "person", id: "preview" }

function withCopies(view: doom.Doom, copies: doom.Copies | null): doom.Doom {
  return copies === null ? view : doom.viewOf(view, [{ once: "carry-copies", author, writes: copies.writes }])
}

function boxesOf(geometry: SlideGeometry, copies: doom.Copies | null): ReadonlyMap<doom.NodeId, doom.Box> {
  const boxes = new Map([...geometry.byId].map(([id, placed]) => [id, placed.node.box]))
  for (const [from, to] of copies?.made ?? []) {
    const box = boxes.get(from)
    if (box !== undefined) boxes.set(to, box)
  }
  return boxes
}

export function liftOf(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  slide: doom.NodeId,
  copies: doom.Copies | null,
): Lift | null {
  const from = aroundPlaced(ids.flatMap((id) => geometry.byId.get(id) ?? []))
  if (from === null) return null
  const roots = copies?.roots ?? ids
  const boxes = boxesOf(geometry, copies)
  const lifted = doom.moveToSlide(withCopies(view, copies), roots, slide, { x: from.left, y: from.top }, { boxes })
  if (doom.isRefusal(lifted)) return null
  return {
    copies,
    roots,
    boxes,
    from,
    carried: new Set(lifted.moved),
    preview: { kind: "move", writes: [...(copies?.writes ?? []), ...lifted.writes], guides: [], label: null },
  }
}

export function carriedTo(input: {
  readonly from: Bounds
  readonly by: Point
  readonly offset: Point
  readonly targets: SnapTargets | null
  readonly reach: number
}): { readonly at: Point; readonly by: Point; readonly guides: readonly Guide[] } {
  const { from, by, offset } = input
  const free = {
    left: from.left + by.x - offset.x,
    top: from.top + by.y - offset.y,
    right: from.right + by.x - offset.x,
    bottom: from.bottom + by.y - offset.y,
  }
  const snapped = input.targets === null ? { box: free, guides: [] } : snapMove(free, input.targets, input.reach)
  const at = { x: Math.round(snapped.box.left), y: Math.round(snapped.box.top) }
  return { at, by: { x: at.x + offset.x - from.left, y: at.y + offset.y - from.top }, guides: snapped.guides }
}

export function slideTargets(geometry: SlideGeometry, size: { readonly w: number; readonly h: number }): SnapTargets {
  return {
    layers: geometry.roots.map((placed) => placed.bounds),
    slide: { left: 0, top: 0, right: size.w, bottom: size.h },
  }
}

export type CarryStep = {
  readonly lift: Lift | null
  readonly over: doom.NodeId | null
  readonly drop: { readonly slide: doom.NodeId; readonly at: Point } | null
  readonly flight: Flight | null
}

export function carryStep(input: {
  readonly over: Exclude<CarryOver, { kind: "home" }>
  readonly lift: Lift | null
  readonly by: Point
  readonly snap: boolean
  readonly reach: number
  readonly size: { readonly w: number; readonly h: number }
}): CarryStep {
  const { over, lift } = input
  if (lift === null) return { lift, over: null, drop: null, flight: null }
  const slide = over.kind === "slide" ? over : null
  const offset = slide?.offset ?? { x: 0, y: 0 }
  const targets = slide?.geometry != null && input.snap ? slideTargets(slide.geometry, input.size) : null
  const drop = carriedTo({ from: lift.from, by: input.by, offset, targets, reach: input.reach })
  return {
    lift,
    over: slide?.slide ?? null,
    drop: slide === null ? null : { slide: slide.slide, at: drop.at },
    flight: { carried: lift.carried, by: drop.by, offset, guides: drop.guides },
  }
}

export function dropWrites(view: doom.Doom, lift: Lift, slide: doom.NodeId, at: Point): readonly doom.Write[] | null {
  const moved = doom.moveToSlide(withCopies(view, lift.copies), lift.roots, slide, at, { boxes: lift.boxes })
  return doom.isRefusal(moved) ? null : [...(lift.copies?.writes ?? []), ...moved.writes]
}

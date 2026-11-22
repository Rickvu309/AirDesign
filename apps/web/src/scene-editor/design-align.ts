import type { scene } from "@airdesign/document"
import type { Bounds } from "@airdesign/render"
import { moveWrites } from "./move-writes"
import type { Point, SlideGeometry } from "./slide-geometry"

export type AlignTo = "left" | "center" | "right" | "top" | "middle" | "bottom"
export type DistributeAcross = "horizontal" | "vertical"

function unionOf(bounds: readonly Bounds[]): Bounds {
  return {
    left: Math.min(...bounds.map((each) => each.left)),
    top: Math.min(...bounds.map((each) => each.top)),
    right: Math.max(...bounds.map((each) => each.right)),
    bottom: Math.max(...bounds.map((each) => each.bottom)),
  }
}

function frameOf(
  geometry: SlideGeometry,
  ids: readonly scene.NodeId[],
  slide: { readonly w: number; readonly h: number },
): Bounds {
  const placed = ids.flatMap((id) => geometry.byId.get(id) ?? [])
  if (ids.length > 1 && placed.length > 1) return unionOf(placed.map((each) => each.bounds))
  const [first] = placed
  const holder = first?.parent == null ? undefined : geometry.byId.get(first.parent)
  return holder === undefined ? { left: 0, top: 0, right: slide.w, bottom: slide.h } : holder.bounds
}

function shiftFor(bounds: Bounds, frame: Bounds, to: AlignTo): Point {
  switch (to) {
    case "left":
      return { x: frame.left - bounds.left, y: 0 }
    case "right":
      return { x: frame.right - bounds.right, y: 0 }
    case "center":
      return { x: (frame.left + frame.right) / 2 - (bounds.left + bounds.right) / 2, y: 0 }
    case "top":
      return { x: 0, y: frame.top - bounds.top }
    case "bottom":
      return { x: 0, y: frame.bottom - bounds.bottom }
    case "middle":
      return { x: 0, y: (frame.top + frame.bottom) / 2 - (bounds.top + bounds.bottom) / 2 }
  }
}

export function alignWrites(
  view: scene.Scene,
  geometry: SlideGeometry,
  ids: readonly scene.NodeId[],
  to: AlignTo,
  slide: { readonly w: number; readonly h: number },
): readonly scene.Write[] {
  const frame = frameOf(geometry, ids, slide)
  return ids.flatMap((id) => {
    const placed = geometry.byId.get(id)
    return placed === undefined ? [] : moveWrites(view, geometry, [id], shiftFor(placed.bounds, frame, to))
  })
}

export function distributeWrites(
  view: scene.Scene,
  geometry: SlideGeometry,
  ids: readonly scene.NodeId[],
  across: DistributeAcross,
): readonly scene.Write[] {
  const horizontal = across === "horizontal"
  const placed = ids
    .flatMap((id) => geometry.byId.get(id) ?? [])
    .sort((a, b) => (horizontal ? a.bounds.left - b.bounds.left : a.bounds.top - b.bounds.top))
  if (placed.length < 3) return []
  const start = (each: Bounds) => (horizontal ? each.left : each.top)
  const end = (each: Bounds) => (horizontal ? each.right : each.bottom)
  const first = placed[0]!.bounds
  const last = placed.at(-1)!.bounds
  const taken = placed.reduce((sum, each) => sum + (end(each.bounds) - start(each.bounds)), 0)
  const gap = (end(last) - start(first) - taken) / (placed.length - 1)
  let cursor = start(first)
  return placed.flatMap((each) => {
    const at = cursor
    cursor += end(each.bounds) - start(each.bounds) + gap
    const by = at - start(each.bounds)
    return moveWrites(view, geometry, [each.id], horizontal ? { x: by, y: 0 } : { x: 0, y: by })
  })
}

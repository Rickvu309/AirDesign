import * as doom from "@airdesign/doom"
import { aroundPlaced, apply, type Placed, type Point, type SlideGeometry } from "@/editing/slide-geometry"

export type Member = {
  readonly id: doom.NodeId
  readonly center: Point
  readonly w: number
  readonly h: number
  readonly rotation: number
}

export type Frame = {
  readonly center: Point
  readonly w: number
  readonly h: number
  readonly rotation: number
  readonly corners: readonly [Point, Point, Point, Point]
}

export function memberOf(placed: Placed): Member {
  const { w, h } = placed.node.box
  return { id: placed.id, center: apply(placed.matrix, { x: w / 2, y: h / 2 }), w, h, rotation: placed.rotation }
}

export function framed(geometry: SlideGeometry, ids: readonly doom.NodeId[], view: doom.Doom): Frame | null {
  const placed = ids.flatMap((id) => geometry.byId.get(id) ?? [])
  const boxed = placed.filter((each) => doom.propOf(view.nodes.get(each.id), "geometry")?.kind !== "line")
  if (boxed.length === 0 || boxed.length !== placed.length) return null
  const [only] = boxed
  if (boxed.length === 1 && only !== undefined) {
    const { w, h } = only.node.box
    return { center: apply(only.matrix, { x: w / 2, y: h / 2 }), w, h, rotation: only.rotation, corners: only.corners }
  }
  const all = aroundPlaced(boxed)
  if (all === null) return null
  const w = all.right - all.left
  const h = all.bottom - all.top
  return {
    center: { x: (all.left + all.right) / 2, y: (all.top + all.bottom) / 2 },
    w,
    h,
    rotation: 0,
    corners: [
      { x: all.left, y: all.top },
      { x: all.right, y: all.top },
      { x: all.right, y: all.bottom },
      { x: all.left, y: all.bottom },
    ],
  }
}

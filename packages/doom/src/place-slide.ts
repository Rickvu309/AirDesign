import type { Doom } from "./doom.js"
import { boxOf, childrenOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"
import { type Matrix, apply, boxMatrix, contentMatrix, identity } from "./matrix.js"
import type { Measure } from "./measure.js"
import type { LayoutBox, Point } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"

export type Bounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type Corners = readonly [Point, Point, Point, Point]

export type PlacedBox = {
  readonly id: NodeId
  readonly parent: NodeId | null
  readonly box: LayoutBox
  readonly matrix: Matrix
  readonly content: Matrix
  readonly corners: Corners
  readonly bounds: Bounds
  readonly rotation: number
}

type Holder = Pick<PlacedBox, "id" | "content" | "rotation">

export function cornersOf(matrix: Matrix, { w, h }: Pick<LayoutBox, "w" | "h">): Corners {
  return [
    apply(matrix, { x: 0, y: 0 }),
    apply(matrix, { x: w, y: 0 }),
    apply(matrix, { x: w, y: h }),
    apply(matrix, { x: 0, y: h }),
  ]
}

export function boundsOf(points: readonly Point[]): Bounds {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

export function placeBox(id: NodeId, box: LayoutBox, parent: Holder | null): PlacedBox {
  const matrix = boxMatrix(parent?.content ?? identity, box)
  const corners = cornersOf(matrix, box)
  return {
    id,
    parent: parent?.id ?? null,
    box,
    matrix,
    content: contentMatrix(matrix, box),
    corners,
    bounds: boundsOf(corners),
    rotation: (parent?.rotation ?? 0) + box.rotation,
  }
}

export function placeBoxes(
  doom: Doom,
  slide: NodeId,
  boxes: ReadonlyMap<NodeId, LayoutBox>,
): ReadonlyMap<NodeId, PlacedBox> {
  const placed = new Map<NodeId, PlacedBox>()
  const walk = (id: NodeId, parent: PlacedBox | null) => {
    for (const node of childrenOf(doom, id)) {
      if (placed.has(node.id)) continue
      const at = placeBox(node.id, boxOf(node, boxes), parent)
      placed.set(node.id, at)
      walk(node.id, at)
    }
  }
  walk(slide, null)
  return placed
}

export function placeSlide(doom: Doom, slide: NodeId, measure: Measure): ReadonlyMap<NodeId, PlacedBox> {
  return placeBoxes(doom, slide, solveLayout(doom, slide, measure))
}

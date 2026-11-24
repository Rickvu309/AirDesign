import * as doom from "@airdesign/doom"
import {
  type Matrix,
  applyMatrix as apply,
  boxMatrix,
  identityMatrix as identity,
  invertMatrix as invert,
} from "@airdesign/doom"
import type { Bounds } from "./snapping"

export { apply, invert }
export type { Matrix }
export type Point = doom.Point
type Corners = readonly [Point, Point, Point, Point]

export type Placed = {
  readonly id: doom.NodeId
  readonly parent: doom.NodeId | null
  readonly node: doom.Resolved
  readonly matrix: Matrix
  readonly corners: Corners
  readonly bounds: Bounds
  readonly rotation: number
  readonly children: readonly Placed[]
}

export type SlideGeometry = {
  readonly roots: readonly Placed[]
  readonly byId: ReadonlyMap<doom.NodeId, Placed>
}

export function linear(matrix: Matrix, by: Point): Point {
  const [a, b, c, d] = matrix
  return { x: a * by.x + c * by.y, y: b * by.x + d * by.y }
}

function boundsOf(corners: Corners): Bounds {
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

function place(node: doom.Resolved, parent: Placed | null, byId: Map<doom.NodeId, Placed>): Placed {
  const matrix = boxMatrix(parent?.matrix ?? identity, node.box)
  const { w, h } = node.box
  const corners: Corners = [
    apply(matrix, { x: 0, y: 0 }),
    apply(matrix, { x: w, y: 0 }),
    apply(matrix, { x: w, y: h }),
    apply(matrix, { x: 0, y: h }),
  ]
  const children: Placed[] = []
  const placed: Placed = {
    id: node.id as doom.NodeId,
    parent: parent?.id ?? null,
    node,
    matrix,
    corners,
    bounds: boundsOf(corners),
    rotation: (parent?.rotation ?? 0) + node.box.rotation,
    children,
  }
  byId.set(placed.id, placed)
  for (const child of node.children) if (!child.derived) children.push(place(child, placed, byId))
  return placed
}

export function geometryOf(nodes: readonly doom.Resolved[]): SlideGeometry {
  const byId = new Map<doom.NodeId, Placed>()
  const roots = nodes.map((node) => place(node, null, byId))
  return { roots, byId }
}

export function aroundPlaced(placed: readonly Placed[]): Bounds | null {
  if (placed.length === 0) return null
  return {
    left: Math.min(...placed.map((each) => each.bounds.left)),
    top: Math.min(...placed.map((each) => each.bounds.top)),
    right: Math.max(...placed.map((each) => each.bounds.right)),
    bottom: Math.max(...placed.map((each) => each.bounds.bottom)),
  }
}

export function ancestorsOf(geometry: SlideGeometry, id: doom.NodeId): readonly Placed[] {
  const chain: Placed[] = []
  for (
    let at = geometry.byId.get(id);
    at !== undefined;
    at = at.parent === null ? undefined : geometry.byId.get(at.parent)
  )
    chain.unshift(at)
  return chain
}

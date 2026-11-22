import type { scene } from "@airdesign/document"
import type { Bounds } from "@airdesign/render"

export type Point = { readonly x: number; readonly y: number }
export type Matrix = readonly [number, number, number, number, number, number]
type Corners = readonly [Point, Point, Point, Point]

export type Placed = {
  readonly id: scene.NodeId
  readonly parent: scene.NodeId | null
  readonly node: scene.Resolved
  readonly matrix: Matrix
  readonly corners: Corners
  readonly bounds: Bounds
  readonly rotation: number
  readonly children: readonly Placed[]
}

export type SlideGeometry = {
  readonly roots: readonly Placed[]
  readonly byId: ReadonlyMap<scene.NodeId, Placed>
}

const identity: Matrix = [1, 0, 0, 1, 0, 0]

export function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left
  const [g, h, i, j, k, l] = right
  return [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f]
}

export function apply(matrix: Matrix, at: Point): Point {
  const [a, b, c, d, e, f] = matrix
  return { x: a * at.x + c * at.y + e, y: b * at.x + d * at.y + f }
}

export function invert(matrix: Matrix): Matrix {
  const [a, b, c, d, e, f] = matrix
  const det = a * d - b * c
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export function linear(matrix: Matrix, by: Point): Point {
  const [a, b, c, d] = matrix
  return { x: a * by.x + c * by.y, y: b * by.x + d * by.y }
}

function boxMatrix(parent: Matrix, box: scene.Box): Matrix {
  const radians = (box.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = box.x + box.w / 2
  const centerY = box.y + box.h / 2
  const turn: Matrix = [
    cos,
    sin,
    -sin,
    cos,
    centerX - cos * (box.w / 2) + sin * (box.h / 2),
    centerY - sin * (box.w / 2) - cos * (box.h / 2),
  ]
  return multiply(parent, turn)
}

function boundsOf(corners: Corners): Bounds {
  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

function place(node: scene.Resolved, parent: Placed | null, byId: Map<scene.NodeId, Placed>): Placed {
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
    id: node.id as scene.NodeId,
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

export function geometryOf(nodes: readonly scene.Resolved[]): SlideGeometry {
  const byId = new Map<scene.NodeId, Placed>()
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

export function ancestorsOf(geometry: SlideGeometry, id: scene.NodeId): readonly Placed[] {
  const chain: Placed[] = []
  for (
    let at = geometry.byId.get(id);
    at !== undefined;
    at = at.parent === null ? undefined : geometry.byId.get(at.parent)
  )
    chain.unshift(at)
  return chain
}

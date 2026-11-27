import * as doom from "@airdesign/doom"
import { type Matrix, applyMatrix as apply, invertMatrix as invert, placeBox } from "@airdesign/doom"
import { masksOf, type Silhouette, silhouetteIn } from "@airdesign/render"

export { apply, invert }
export type { Matrix }
export type Point = doom.Point
export type Bounds = doom.Bounds

export type Placed = doom.PlacedBox & {
  readonly node: doom.Resolved
  readonly reveals: Silhouette | null
  readonly maskedBy: Silhouette | null
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

function placeAll(
  nodes: readonly doom.Resolved[],
  parent: Placed | null,
  byId: Map<doom.NodeId, Placed>,
): readonly Placed[] {
  const within = parent?.content ?? doom.identityMatrix
  const masks = masksOf(nodes)
  const outlines = new Map(nodes.filter((node) => node.mask).map((node) => [node, silhouetteIn(node, within)]))
  return nodes.map((node, index) => {
    const mask = masks[index]
    const children: Placed[] = []
    const placed: Placed = {
      ...placeBox(node.id as doom.NodeId, node.box, parent),
      node,
      reveals: outlines.get(node) ?? null,
      maskedBy: (mask && outlines.get(mask)) ?? null,
      children,
    }
    byId.set(placed.id, placed)
    children.push(...placeAll(node.children, placed, byId))
    return placed
  })
}

export function geometryOf(nodes: readonly doom.Resolved[]): SlideGeometry {
  const byId = new Map<doom.NodeId, Placed>()
  const roots = placeAll(nodes, null, byId)
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

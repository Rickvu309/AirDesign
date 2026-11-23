import * as doom from "@airdesign/doom"
import { apply, invert, type Placed, type Point } from "./slide-geometry"

export type Skip = (id: doom.NodeId) => boolean

function paints(node: doom.Resolved): boolean {
  if (node.fills.length > 0 || node.strokes.length > 0) return true
  if (node.type === "frame") return node.children.some((child) => child.derived)
  return node.text !== null || node.geometry?.kind === "icon"
}

function bodyHit(placed: Placed, local: Point, reach: number): boolean {
  const { node } = placed
  const { w, h } = node.box
  const { geometry } = node
  if (geometry?.kind === "line") {
    const weight = node.stroke?.weight ?? 1
    return doom.distanceToSegment(local, geometry.from, geometry.to) <= Math.max(reach, weight / 2 + reach / 2)
  }
  if (!paints(node)) return false
  if (geometry?.kind === "ellipse") {
    const across = (local.x - w / 2) / Math.max(w / 2, 1e-6)
    const down = (local.y - h / 2) / Math.max(h / 2, 1e-6)
    return across * across + down * down <= 1
  }
  if (geometry?.kind === "preset") return doom.presetHolds(geometry.name, w, h, geometry.adjust, local, reach)
  return local.x >= 0 && local.y >= 0 && local.x <= w && local.y <= h
}

export function hitChain(
  nodes: readonly Placed[],
  at: Point,
  reach: number,
  skip: Skip = () => false,
): readonly Placed[] | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const placed = nodes[index]!
    if (skip(placed.id)) continue
    const local = apply(invert(placed.matrix), at)
    const { w, h } = placed.node.box
    const reachable = !placed.node.clip || (local.x >= 0 && local.y >= 0 && local.x <= w && local.y <= h)
    const below = reachable && placed.children.length > 0 ? hitChain(placed.children, at, reach, skip) : null
    if (below !== null) return [placed, ...below]
    if (bodyHit(placed, local, reach)) return [placed]
  }
  return null
}

export function intersects(
  placed: Placed,
  rect: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
): boolean {
  const { bounds } = placed
  return (
    bounds.left <= rect.right && bounds.right >= rect.left && bounds.top <= rect.bottom && bounds.bottom >= rect.top
  )
}

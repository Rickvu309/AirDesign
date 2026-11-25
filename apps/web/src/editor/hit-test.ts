import * as doom from "@airdesign/doom"
import { type Silhouette } from "@airdesign/render"
import { apply, invert, type Placed, type Point } from "./slide-geometry"

export type Skip = (id: doom.NodeId) => boolean

function paints(node: doom.Resolved): boolean {
  if (node.fills.length > 0 || node.strokes.length > 0) return true
  return node.text !== null || node.geometry?.kind === "icon"
}

function bodyHit(placed: Placed, local: Point, reach: number): boolean {
  const { node } = placed
  const { w, h } = node.box
  const { geometry } = node
  if (geometry?.kind === "line") {
    const weight = node.stroke?.weight ?? 1
    return (
      doom.routeDistance(geometry.points, geometry.route === "curve", local) <= Math.max(reach, weight / 2 + reach / 2)
    )
  }
  if (!paints(node)) return false
  if (geometry?.kind === "ellipse") {
    const across = (local.x - w / 2) / Math.max(w / 2, 1e-6)
    const down = (local.y - h / 2) / Math.max(h / 2, 1e-6)
    return across * across + down * down <= 1
  }
  if (geometry?.kind === "preset") return doom.presetHolds(geometry.name, w, h, geometry.adjust, local, reach)
  const inBox = local.x >= 0 && local.y >= 0 && local.x <= w && local.y <= h
  if (geometry?.kind !== "path") return inBox
  if (inBox && node.text !== null) return true
  return pathHit(node, geometry, local, reach, inBox)
}

let scratch: CanvasRenderingContext2D | null = null
type PathData = { readonly d: string }
type PathGeometry = Extract<doom.Resolved["geometry"], { kind: "path" }>
const paths = new WeakMap<PathData, Path2D>()
const pathBounds = new WeakMap<PathData, DOMRect>()
const svgNamespace = "http://www.w3.org/2000/svg"
let boundsProbe: SVGPathElement | undefined

function boundsOf(shape: PathData): DOMRect {
  const cached = pathBounds.get(shape)
  if (cached !== undefined) return cached
  if (boundsProbe === undefined) {
    const svg = document.createElementNS(svgNamespace, "svg")
    svg.setAttribute("aria-hidden", "true")
    svg.style.cssText = "position:fixed;width:0;height:0;visibility:hidden;pointer-events:none"
    boundsProbe = document.createElementNS(svgNamespace, "path")
    svg.append(boundsProbe)
    document.body.append(svg)
  }
  boundsProbe.setAttribute("d", shape.d)
  const bounds = boundsProbe.getBBox()
  pathBounds.set(shape, bounds)
  return bounds
}

function pathOf(shape: PathData): Path2D {
  const cached = paths.get(shape)
  if (cached !== undefined) return cached
  const path = new Path2D(shape.d)
  paths.set(shape, path)
  return path
}

function holds(shape: Silhouette, at: Point): boolean {
  scratch ??= document.createElement("canvas").getContext("2d")
  if (scratch === null) return false
  scratch.setTransform(...shape.matrix)
  return scratch.isPointInPath(pathOf(shape), at.x, at.y)
}

function pathHit(node: doom.Resolved, geometry: PathGeometry, local: Point, reach: number, inBox: boolean): boolean {
  const { w, h, flipH, flipV } = node.box
  const x = flipH ? w - local.x : local.x
  const y = flipV ? h - local.y : local.y
  const filled = inBox && node.fills.length > 0
  const { stroke, strokes } = node
  const sides = strokes[0]?.kind === "solid" ? stroke?.sides : undefined
  const width =
    stroke === null || strokes.length === 0 || stroke.weight === 0 ? 0 : Math.max(2 * reach, stroke.weight + reach)
  let stroked = false
  if (width > 0 && sides === undefined) {
    const bounds = geometry.bounds ?? boundsOf(geometry)
    const pad = width / 2
    stroked =
      x >= bounds.x - pad &&
      y >= bounds.y - pad &&
      x <= bounds.x + bounds.width + pad &&
      y <= bounds.y + bounds.height + pad
  }
  if (!filled && !stroked && sides === undefined) return false
  if (filled || stroked) {
    scratch ??= document.createElement("canvas").getContext("2d")
    if (scratch === null) return false
    scratch.resetTransform()
    const path = pathOf(geometry)
    if (filled && scratch.isPointInPath(path, x, y)) return true
    if (stroked) {
      scratch.lineWidth = width
      scratch.lineCap = "round"
      scratch.lineJoin = "round"
      return scratch.isPointInStroke(path, x, y)
    }
  }
  return (
    sides !== undefined &&
    inBox &&
    (y < (sides.t ?? 0) || h - y < (sides.b ?? 0) || x < (sides.l ?? 0) || w - x < (sides.r ?? 0))
  )
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
    if (placed.maskedBy !== null && !holds(placed.maskedBy, at)) continue
    if (placed.reveals !== null) {
      if (holds(placed.reveals, at)) return [placed]
      continue
    }
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

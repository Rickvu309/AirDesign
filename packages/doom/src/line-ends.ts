import type { NodeId } from "./ids.js"
import type { Box, Point } from "./resolved.js"
import type { Doom } from "./doom.js"
import { curvePoints, elbowPoints, type RouteEnd } from "./line-route.js"
import { distanceToSegment, siteSpot } from "./preset-geometry.js"
import type { Props } from "./props.js"

type Line = Extract<NonNullable<Props["geometry"]>, { kind: "line" }>

const parentOf = (doom: Doom, id: NodeId): NodeId | undefined =>
  (doom.nodes.get(id) as { parent?: { id: NodeId } | null } | undefined)?.parent?.id

function positionOf(doom: Doom, boxes: ReadonlyMap<NodeId, Box>, id: NodeId): Point | null {
  if (!boxes.has(id)) return null
  let x = 0
  let y = 0
  for (let at: NodeId | undefined = id; at !== undefined && boxes.has(at); at = parentOf(doom, at)) {
    const box = boxes.get(at)!
    x += box.x
    y += box.y
  }
  return { x, y }
}

export type LineRoute = { readonly from: Point; readonly to: Point; readonly points: readonly Point[] }

export function lineRoute(
  doom: Doom,
  boxes: ReadonlyMap<NodeId, Box>,
  parent: NodeId | undefined,
  line: Line,
): LineRoute {
  const origin = (parent === undefined ? null : positionOf(doom, boxes, parent)) ?? { x: 0, y: 0 }
  const resolve = (end: Line["start"]): RouteEnd => {
    if ("x" in end) return { at: { x: end.x, y: end.y }, side: null, around: null }
    const at = positionOf(doom, boxes, end.node)
    const box = boxes.get(end.node)
    if (at === null || box === undefined) return { at: { x: 0, y: 0 }, side: null, around: null }
    const geometry = (doom.nodes.get(end.node) as Partial<Props> | undefined)?.geometry
    const spot = siteSpot(geometry, box.w, box.h, end.site)
    const x = at.x - origin.x
    const y = at.y - origin.y
    return {
      at: { x: x + spot.x, y: y + spot.y },
      side: end.site === "c" ? null : end.site,
      around: { x, y, w: box.w, h: box.h },
    }
  }
  const start = resolve(line.start)
  const end = resolve(line.end)
  const points =
    line.route === "elbow"
      ? elbowPoints(start, end)
      : line.route === "curve"
        ? curvePoints(start, end)
        : [start.at, end.at]
  return { from: start.at, to: end.at, points }
}

function routeSpots(points: readonly Point[], curved: boolean): readonly Point[] {
  const [from, pullFrom, pullTo, to] = points
  return curved && from !== undefined && pullFrom !== undefined && pullTo !== undefined && to !== undefined
    ? Array.from({ length: 17 }, (_, step) => cubicAt(from, pullFrom, pullTo, to, step / 16))
    : points
}

export function routeDistance(points: readonly Point[], curved: boolean, at: Point): number {
  const spots = routeSpots(points, curved)
  if (spots.length === 1) return Math.hypot(at.x - spots[0]!.x, at.y - spots[0]!.y)
  return Math.min(
    Number.POSITIVE_INFINITY,
    ...spots.slice(1).map((spot, index) => distanceToSegment(at, spots[index]!, spot)),
  )
}

export function routeBox(route: LineRoute, curved: boolean): Box {
  const spots = routeSpots(route.points, curved)
  const xs = spots.map((spot) => spot.x)
  const ys = spots.map((spot) => spot.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, rotation: 0, flipH: false, flipV: false }
}

function cubicAt(from: Point, pullFrom: Point, pullTo: Point, to: Point, share: number): Point {
  const rest = 1 - share
  const a = rest * rest * rest
  const b = 3 * rest * rest * share
  const c = 3 * rest * share * share
  const d = share * share * share
  return {
    x: a * from.x + b * pullFrom.x + c * pullTo.x + d * to.x,
    y: a * from.y + b * pullFrom.y + c * pullTo.y + d * to.y,
  }
}

export function boxBetween(from: Point, to: Point): Box {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    w: Math.abs(to.x - from.x),
    h: Math.abs(to.y - from.y),
    rotation: 0,
    flipH: false,
    flipV: false,
  }
}

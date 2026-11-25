import type { NodeId } from "./ids.js"
import type { Box, Point } from "./resolved.js"
import type { Doom } from "./doom.js"
import { propOf } from "./doom-walk.js"
import { curvePoints, elbowPoints, type RouteEnd, type Side } from "./line-route.js"
import { distanceToSegment, outlineRings, type Shaped, type Site, siteSpot } from "./preset-geometry.js"
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

const sideTurns: readonly Side[] = ["t", "r", "b", "l"]
const empty: Box = { x: 0, y: 0, w: 0, h: 0, rotation: 0, flipH: false, flipV: false }

function resting(
  doom: Doom,
  boxes: ReadonlyMap<NodeId, Box>,
  id: NodeId,
): { readonly at: Point; readonly box: Box } | null {
  const node = doom.nodes.get(id)
  if (node === undefined) return null
  const own = propOf(node, "box") ?? empty
  const parent = parentOf(doom, id)
  if (parent === undefined) return { at: { x: own.x, y: own.y }, box: own }
  let x = own.x
  let y = own.y
  for (let at: NodeId | undefined = parent, hops = 0; at !== undefined && hops <= doom.nodes.size; hops += 1) {
    if (boxes.has(at)) {
      const origin = positionOf(doom, boxes, at)
      if (origin === null) return null
      return { at: { x: x + origin.x, y: y + origin.y }, box: own }
    }
    const current = doom.nodes.get(at)
    if (current === undefined) return null
    if (current.type === "slide" || current.type === "slideRow" || current.type === "deck") {
      return { at: { x, y }, box: own }
    }
    const box = propOf(current, "box") ?? empty
    x += box.x
    y += box.y
    at = parentOf(doom, at)
  }
  return { at: { x, y }, box: own }
}

export function endOnShape(shaped: Shaped | null | undefined, box: Box, x: number, y: number, site: Site): RouteEnd {
  const center = { x: x + box.w / 2, y: y + box.h / 2 }
  const radians = (box.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const settle = (value: number) => Math.round(value * 1e6) / 1e6
  const turn = (point: Point): Point =>
    box.rotation % 360 === 0
      ? { x: x + point.x, y: y + point.y }
      : {
          x: settle(center.x + (x + point.x - center.x) * cos - (y + point.y - center.y) * sin),
          y: settle(center.y + (x + point.x - center.x) * sin + (y + point.y - center.y) * cos),
        }
  const outline = outlineRings(shaped, box.w, box.h).map((ring) => ring.map(turn))
  const corners = [
    turn({ x: 0, y: 0 }),
    turn({ x: box.w, y: 0 }),
    turn({ x: box.w, y: box.h }),
    turn({ x: 0, y: box.h }),
  ]
  const left = Math.min(...corners.map((corner) => corner.x))
  const top = Math.min(...corners.map((corner) => corner.y))
  const quarter = Math.round(box.rotation / 90)
  return {
    at: turn(siteSpot(shaped, box.w, box.h, site)),
    side: site === "c" ? null : sideTurns[(((sideTurns.indexOf(site) + quarter) % 4) + 4) % 4]!,
    around: {
      x: left,
      y: top,
      w: Math.max(...corners.map((corner) => corner.x)) - left,
      h: Math.max(...corners.map((corner) => corner.y)) - top,
    },
    outline,
  }
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
    const placed = at !== null && box !== undefined ? { at, box } : resting(doom, boxes, end.node)
    if (placed === null) return { at: { x: 0, y: 0 }, side: null, around: null }
    const geometry = propOf(doom.nodes.get(end.node), "geometry")
    return endOnShape(geometry, placed.box, placed.at.x - origin.x, placed.at.y - origin.y, end.site)
  }
  const start = resolve(line.start)
  const end = resolve(line.end)
  const points =
    line.route === "elbow"
      ? elbowPoints(start, end, line.channels)
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

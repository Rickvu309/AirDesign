import type { NodeId } from "./ids.js"
import type { Box, Point } from "./resolved.js"
import type { Doom } from "./doom.js"
import { siteSpot } from "./preset-geometry.js"
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

export function lineEnds(
  doom: Doom,
  boxes: ReadonlyMap<NodeId, Box>,
  parent: NodeId | undefined,
  line: Line,
): { readonly from: Point; readonly to: Point } {
  const origin = (parent === undefined ? null : positionOf(doom, boxes, parent)) ?? { x: 0, y: 0 }
  const resolve = (end: Line["start"]): Point => {
    if ("x" in end) return { x: end.x, y: end.y }
    const at = positionOf(doom, boxes, end.node)
    const box = boxes.get(end.node)
    if (at === null || box === undefined) return { x: 0, y: 0 }
    const geometry = (doom.nodes.get(end.node) as Partial<Props> | undefined)?.geometry
    const spot = siteSpot(geometry, box.w, box.h, end.site)
    return { x: at.x + spot.x - origin.x, y: at.y + spot.y - origin.y }
  }
  return { from: resolve(line.start), to: resolve(line.end) }
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

import type { NodeId } from "./ids.js"
import type { Box, Point } from "./resolved.js"
import type { Scene } from "./scene.js"
import type { Props } from "./props.js"

type Line = Extract<NonNullable<Props["geometry"]>, { kind: "line" }>

const parentOf = (scene: Scene, id: NodeId): NodeId | undefined =>
  (scene.nodes.get(id) as { parent?: { id: NodeId } | null } | undefined)?.parent?.id

function positionOf(scene: Scene, boxes: ReadonlyMap<NodeId, Box>, id: NodeId): Point | null {
  if (!boxes.has(id)) return null
  let x = 0
  let y = 0
  for (let at: NodeId | undefined = id; at !== undefined && boxes.has(at); at = parentOf(scene, at)) {
    const box = boxes.get(at)!
    x += box.x
    y += box.y
  }
  return { x, y }
}

const spots = {
  t: [0.5, 0],
  r: [1, 0.5],
  b: [0.5, 1],
  l: [0, 0.5],
  c: [0.5, 0.5],
} as const

export function lineEnds(
  scene: Scene,
  boxes: ReadonlyMap<NodeId, Box>,
  parent: NodeId | undefined,
  line: Line,
): { readonly from: Point; readonly to: Point } {
  const origin = (parent === undefined ? null : positionOf(scene, boxes, parent)) ?? { x: 0, y: 0 }
  const resolve = (end: Line["start"]): Point => {
    if ("x" in end) return { x: end.x, y: end.y }
    const at = positionOf(scene, boxes, end.node)
    const box = boxes.get(end.node)
    if (at === null || box === undefined) return { x: 0, y: 0 }
    const [across, down] = spots[end.site]
    return { x: at.x + box.w * across - origin.x, y: at.y + box.h * down - origin.y }
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

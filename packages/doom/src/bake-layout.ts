import type { NodeId } from "./ids.js"
import type { Sizing } from "./layout.js"
import type { Measure } from "./measure.js"
import type { Doom, Node, Write } from "./doom.js"
import { childrenOf, get, slideOf } from "./doom-walk.js"
import type { Box } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"

const sameBox = (left: Box | undefined, right: Box) =>
  left !== undefined &&
  left.x === right.x &&
  left.y === right.y &&
  left.w === right.w &&
  left.h === right.h &&
  left.rotation === right.rotation &&
  left.flipH === right.flipH &&
  left.flipV === right.flipV

function fixed(node: Node, from: Sizing["w"]): Write[] {
  const sizing = get(node, "sizing")
  if (sizing === undefined) return []
  const next = { w: sizing.w === from ? "fixed" : sizing.w, h: sizing.h === from ? "fixed" : sizing.h }
  return next.w === sizing.w && next.h === sizing.h ? [] : [{ node: node.id, prop: "sizing", value: next }]
}

function boxWrite(node: Node, boxes: ReadonlyMap<NodeId, Box>): Write[] {
  const solved = boxes.get(node.id)
  return solved === undefined || sameBox(get(node, "box"), solved)
    ? []
    : [{ node: node.id, prop: "box", value: solved }]
}

export function bakeLayout(doom: Doom, frame: NodeId, measure: Measure): readonly Write[] {
  const node = doom.nodes.get(frame)
  const slide = slideOf(doom, frame)
  if (node?.type !== "frame" || slide === undefined) return []
  const boxes = solveLayout(doom, slide, measure)
  const layout = get(node, "layout")
  const children = childrenOf(doom, frame).filter(
    (child) => get(child, "hidden") !== true && get(child, "geometry")?.kind !== "line",
  )
  const off: readonly Write[] =
    layout === undefined || layout.mode === "none" ? [] : [{ node: frame, prop: "layout", value: { mode: "none" } }]
  return [
    ...off,
    ...boxWrite(node, boxes),
    ...fixed(node, "hug"),
    ...children.flatMap((child) => [
      ...boxWrite(child, boxes),
      ...fixed(child, "fill"),
      ...(get(child, "cell") === undefined ? [] : [{ node: child.id, prop: "cell", value: null } satisfies Write]),
    ]),
  ]
}

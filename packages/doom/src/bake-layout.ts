import type { NodeId } from "./ids.js"
import type { Sizing } from "./layout.js"
import { measureWith, type Measure } from "./measure.js"
import { unfittedBox } from "./matrix.js"
import type { Doom, Node, Write } from "./doom.js"
import { childrenOf, descendantsOf, isLaidOut, parentOf, propOf, slideOf } from "./doom-walk.js"
import type { Box, LayoutBox } from "./resolved.js"
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
  const sizing = propOf(node, "sizing")
  if (sizing === undefined) return []
  const next = { w: sizing.w === from ? "fixed" : sizing.w, h: sizing.h === from ? "fixed" : sizing.h }
  return next.w === sizing.w && next.h === sizing.h ? [] : [{ node: node.id, prop: "sizing", value: next }]
}

function boxWrite(node: Node, boxes: ReadonlyMap<NodeId, LayoutBox>): Write[] {
  const solved = boxes.get(node.id)
  const box = solved === undefined ? undefined : unfittedBox(solved)
  return box === undefined || sameBox(propOf(node, "box"), box) ? [] : [{ node: node.id, prop: "box", value: box }]
}

export function bakeLayout(doom: Doom, frame: NodeId, measure: Measure): readonly Write[] {
  const node = doom.nodes.get(frame)
  if (node?.type !== "frame" || slideOf(doom, frame) === undefined) return []
  const boxes = bakeBoxes(doom, node, measure)
  const layout = propOf(node, "layout")
  const children = childrenOf(doom, frame).filter(
    (child) => propOf(child, "hidden") !== true && propOf(child, "geometry")?.kind !== "line",
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
      ...(propOf(child, "cell") === undefined ? [] : [{ node: child.id, prop: "cell", value: null } satisfies Write]),
    ]),
  ]
}

function bakeBoxes(doom: Doom, frame: Node, measure: Parameters<typeof solveLayout>[2]) {
  let root = frame
  let hidden = false
  const path: NodeId[] = []
  for (;;) {
    hidden ||= propOf(root, "hidden") === true
    const up = parentOf(root)
    const parent = up === undefined || up === null ? undefined : doom.nodes.get(up.id)
    if (parent === undefined || !isLaidOut(parent) || propOf(root, "absolute") === true) break
    path.unshift(root.id)
    root = parent
  }
  return solveLayout(doom, root.id, measure, hidden ? undefined : path)
}

const estimate = measureWith({})

export function bakeTextLayers(
  doom: Doom,
  frame: NodeId,
): { readonly required: readonly NodeId[]; readonly measured: readonly NodeId[] } {
  const node = doom.nodes.get(frame)
  if (node?.type !== "frame") return { required: [], measured: [] }
  const layers = new Set<NodeId>()
  bakeBoxes(doom, node, (text, theme, width, _fit, id) => {
    layers.add(id)
    return estimate(text, theme, width)
  })
  const inside = new Set(descendantsOf(doom, frame).map((child) => child.id))
  return { required: [...layers].filter((layer) => inside.has(layer)), measured: [...layers] }
}

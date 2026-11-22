import type { scene } from "@airdesign/document"
import { propOf } from "./node-props"
import type { SlideGeometry } from "./slide-geometry"

export function isGroup(view: scene.Scene, id: scene.NodeId): boolean {
  const node = view.nodes.get(id)
  if (node === undefined || node.type !== "frame") return false
  const sizing = propOf(node, "sizing")
  return (
    (propOf(node, "fills") ?? []).length === 0 &&
    (propOf(node, "strokes") ?? []).length === 0 &&
    (propOf(node, "layout")?.mode ?? "none") === "none" &&
    sizing?.w === "hug" &&
    sizing.h === "hug"
  )
}

function scaledEnd(end: scene.End, across: number, down: number): scene.End {
  return "node" in end ? end : { x: Math.round(end.x * across), y: Math.round(end.y * down) }
}

export function scaledChildren(
  view: scene.Scene,
  geometry: SlideGeometry,
  id: scene.NodeId,
  across: number,
  down: number,
): readonly scene.Write[] {
  return (view.children.get(id) ?? []).flatMap((child): scene.Write[] => {
    const node = view.nodes.get(child)
    const placed = geometry.byId.get(child)
    if (node === undefined || placed === undefined) return []
    const line = propOf(node, "geometry")
    if (line?.kind === "line")
      return [
        {
          node: child,
          prop: "geometry",
          value: { ...line, start: scaledEnd(line.start, across, down), end: scaledEnd(line.end, across, down) },
        },
      ]
    const stored = propOf(node, "box") ?? placed.node.box
    const box = {
      ...stored,
      x: Math.round(stored.x * across),
      y: Math.round(stored.y * down),
      w: Math.max(1, Math.round(stored.w * across)),
      h: Math.max(1, Math.round(stored.h * down)),
    }
    return [
      { node: child, prop: "box", value: box },
      ...(isGroup(view, child) ? scaledChildren(view, geometry, child, across, down) : []),
    ]
  })
}

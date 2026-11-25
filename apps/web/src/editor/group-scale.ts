import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"
import type { SlideGeometry } from "./slide-geometry"

export function isGroup(view: doom.Doom, id: doom.NodeId): boolean {
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

function scaledEnd(end: doom.End, across: number, down: number): doom.End {
  return "node" in end ? end : { x: Math.round(end.x * across), y: Math.round(end.y * down) }
}

export function scaledChildren(
  view: doom.Doom,
  geometry: SlideGeometry,
  id: doom.NodeId,
  across: number,
  down: number,
): readonly doom.Write[] {
  return (view.children.get(id) ?? []).flatMap((child): doom.Write[] => {
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
    const least = doom.componentMinimum(view, child) ?? { w: 1, h: 1 }
    const box = {
      ...stored,
      x: Math.round(stored.x * across),
      y: Math.round(stored.y * down),
      w: Math.max(least.w, Math.round(stored.w * across)),
      h: Math.max(least.h, Math.round(stored.h * down)),
    }
    return [
      { node: child, prop: "box", value: box },
      ...(isGroup(view, child) ? scaledChildren(view, geometry, child, across, down) : []),
    ]
  })
}

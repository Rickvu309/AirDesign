import type { Node } from "./doom.js"
import { propOf } from "./doom-walk.js"

export function kindOf(node: Node): string {
  if (node.type === "slide" || node.type === "slideRow") return node.type
  if (node.type === "frame") return "frame"
  const kind = propOf(node, "geometry")?.kind
  if (kind === "line" || kind === "icon" || kind === "path") return kind
  const fills = propOf(node, "fills") ?? []
  if (fills.some((paint) => paint.kind === "image")) return "picture"
  const painted = fills.length > 0 || (propOf(node, "strokes") ?? []).length > 0
  return propOf(node, "text") !== undefined && !painted ? "text" : "shape"
}

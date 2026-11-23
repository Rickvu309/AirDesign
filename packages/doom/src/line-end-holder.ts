import type { Doom } from "./doom.js"
import { get, lockedIn, slideOf } from "./doom-walk.js"
import type { NodeId } from "./ids.js"

export function holdsLineEnd(
  doom: Doom,
  target: NodeId,
  line: NodeId | null,
  slide: NodeId | undefined = line === null ? undefined : slideOf(doom, line),
): boolean {
  const node = doom.nodes.get(target)
  if (node === undefined || target === line || (node.type !== "shape" && node.type !== "frame")) return false
  if (get(node, "geometry")?.kind === "line" || slideOf(doom, target) !== slide) return false
  return !lockedIn(doom, target)
}

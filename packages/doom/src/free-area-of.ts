import { draftOf } from "./agent-draft.js"
import { freeArea } from "./agent-place.js"
import type { Doom } from "./doom.js"
import type { NodeId } from "./ids.js"

export function freeAreaOf(
  doom: Doom,
  parent: NodeId,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | undefined {
  const node = doom.nodes.get(parent)
  if (node === undefined) return undefined
  return freeArea(
    draftOf(doom, () => parent),
    node,
  )
}

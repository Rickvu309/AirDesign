import type { Doom } from "../doom.js"
import { propOf } from "../doom-walk.js"
import type { NodeId } from "../ids.js"
import { refuse, type Refusal } from "../refusal.js"
import { resolveComponentInFold } from "./deck-component.js"

type Size = { readonly w: number; readonly h: number }

export function componentMinimum(doom: Doom, node: NodeId): Size | undefined {
  const reference = propOf(doom.nodes.get(node), "instance")?.component
  return reference === undefined ? undefined : resolveComponentInFold(doom, reference)?.spec.minFrame
}

export function belowMinimum(minimum: Size | undefined, size: Size, node: NodeId): Refusal | undefined {
  if (minimum === undefined || (size.w >= minimum.w && size.h >= minimum.h)) return undefined
  return {
    ...refuse("shape", node, "box"),
    fault: "needs",
    needs: `a size of at least ${String(minimum.w)} × ${String(minimum.h)} px`,
  }
}

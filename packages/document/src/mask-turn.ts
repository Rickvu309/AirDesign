import { landedPatch, type Command, type Register } from "./decide.js"
import type { ElementId, SlideId } from "./element-id.js"
import { format } from "./format.js"
import { groupOf } from "./group-place.js"
import { slideUndoable, type Undoable } from "./person-undo.js"
import { beforeOf, type ElementPatch } from "./row.js"

export type MaskTurn = { readonly commands: readonly Command[]; readonly undoable: Undoable }

export function maskTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
  nodes: readonly ElementId[],
  mask: ElementId,
): MaskTurn | null {
  const edit = groupOf(register, slide, node, nodes)
  if (!nodes.includes(mask) || edit === null) return null
  const formed = slideUndoable(register, file, edit)
  if (formed === null || !("group" in formed)) return null
  const after: ElementPatch = { identity: { mask: { set: true } } }
  const body = register.elements[mask]
  const before = beforeOf(body === undefined ? {} : landedPatch(body, "text"), after)
  return {
    commands: [
      { command: "slide", file, edit },
      { command: "person", v: format, patch: after, node: mask },
    ],
    undoable: { ...formed, rows: [{ node: mask, before, after }] },
  }
}

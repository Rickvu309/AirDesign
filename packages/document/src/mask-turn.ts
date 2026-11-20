import { landedPatch, type Command, type Register } from "./decide.js"
import { groupBounds, type ElementGroup } from "./element-group.js"
import type { ElementId, SlideId } from "./element-id.js"
import { format } from "./format.js"
import { groupOf } from "./group-place.js"
import { slideUndoable, type NodeStep, type Undoable } from "./person-undo.js"
import { beforeOf, type ElementPatch } from "./row.js"

export type MaskTurn = { readonly commands: readonly Command[]; readonly undoable: Undoable }

export const maskGroupName = "Mask group"

function fittedToMask(edit: ElementGroup, mask: ElementId): ElementGroup | null {
  const outline = edit.members.filter((member) => member.node === mask)
  if (outline.length === 0) return null
  const rest = edit.members.filter((member) => member.node !== mask)
  return { ...edit, element: { ...edit.element, box: groupBounds(outline) }, members: [...outline, ...rest] }
}

function rowStep(register: Register, node: ElementId, after: ElementPatch): NodeStep {
  const body = register.elements[node]
  return { node, before: beforeOf(body === undefined ? {} : landedPatch(body, "text"), after), after }
}

export function maskTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
  nodes: readonly ElementId[],
  mask: ElementId,
): MaskTurn | null {
  const grouped = groupOf(register, slide, node, nodes)
  const edit = grouped === null ? null : fittedToMask(grouped, mask)
  if (edit === null) return null
  const formed = slideUndoable(register, file, edit)
  if (formed === null || !("group" in formed)) return null
  const masked: ElementPatch = { identity: { mask: { set: true } } }
  const named: ElementPatch = { identity: { name: { set: maskGroupName } } }
  return {
    commands: [
      { command: "slide", file, edit },
      { command: "person", v: format, patch: masked, node: mask },
      { command: "person", v: format, patch: named, node },
    ],
    undoable: { ...formed, rows: [rowStep(register, mask, masked), rowStep(register, node, named)] },
  }
}

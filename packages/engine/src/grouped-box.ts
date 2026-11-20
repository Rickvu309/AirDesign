import { followsGroups, groupedNow, shownPlace, storedPlace, type Register } from "@airdesign/document"
import type { WireChange } from "@airdesign/catalog"

export function inGroupSpace(register: Register, edit: WireChange): WireChange | null {
  if (edit.property !== "box" || !groupedNow(register, edit.node)) return edit
  const shown = followsGroups(register, edit.node) ? shownPlace(register, edit.node) : null
  const stored = shown === null ? null : storedPlace(register, edit.node, { ...shown, box: edit.value })
  return stored === null ? null : { ...edit, value: stored.box }
}

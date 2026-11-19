import { readTableValue, type SlideCommand, type TraitName, type Value } from "@airdesign/document"

export function authorableTrait(trait: TraitName): boolean {
  return trait !== "table" && trait !== "layout"
}

export function authorableValue(edit: Value): boolean {
  if (edit.v !== undefined) return edit.patch.table === undefined
  return edit.property === "box" || readTableValue(edit.value) === null
}

export function authorableSlide(edit: SlideCommand): boolean {
  return edit.slide !== "element-add" || edit.element.kind !== "table"
}

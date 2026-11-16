import type { ElementId } from "@airdesign/document"
import type { CanvasSlide } from "./record.js"

export type Selection = { readonly ids: readonly ElementId[]; readonly inside: ElementId | null }

export const noSelection: Selection = { ids: [], inside: null }

export function leadOf(selection: Selection): ElementId | null {
  return selection.ids.at(-1) ?? null
}

function parentOf(slide: CanvasSlide, id: ElementId): ElementId | null {
  return slide.elements.find((each) => each.id === id)?.group?.id ?? null
}

function unitIn(slide: CanvasSlide, inside: ElementId | null, pressed: ElementId): ElementId {
  let unit = pressed
  for (let parent = parentOf(slide, unit); parent !== null && parent !== inside; parent = parentOf(slide, unit)) {
    unit = parent
  }
  return unit
}

export function unitOf(slide: CanvasSlide, selection: Selection, pressed: ElementId): ElementId {
  return unitIn(slide, selection.inside, pressed)
}

export function alone(slide: CanvasSlide, id: ElementId): Selection {
  return { ids: [id], inside: parentOf(slide, id) }
}

export function picked(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection {
  const unit = unitOf(slide, selection, pressed)
  const opened = selection.ids.length === 1 && selection.ids[0] === unit && unit !== pressed
  return alone(slide, opened ? unitIn(slide, unit, pressed) : unit)
}

export function toggled(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection {
  const unit = unitOf(slide, selection, pressed)
  const inside = parentOf(slide, unit)
  if (inside !== selection.inside) return { ids: [unit], inside }
  const ids = selection.ids.includes(unit) ? selection.ids.filter((id) => id !== unit) : [...selection.ids, unit]
  return { ids, inside }
}

export function focused(slide: CanvasSlide, selection: Selection, id: ElementId): Selection {
  if (!selection.ids.includes(id)) return alone(slide, id)
  if (leadOf(selection) === id) return selection
  return { ids: [...selection.ids.filter((each) => each !== id), id], inside: selection.inside }
}

export function kept(selection: Selection, slide: CanvasSlide): Selection {
  const shown = new Set(slide.elements.flatMap((each) => (each.id === null ? [] : [each.id])))
  const inside = selection.inside !== null && shown.has(selection.inside) ? selection.inside : null
  const ids = selection.ids.filter((id) => shown.has(id) && parentOf(slide, id) === inside)
  return ids.length === selection.ids.length && inside === selection.inside ? selection : { ids, inside }
}

export function sameSelection(one: Selection, other: Selection): boolean {
  return (
    one.inside === other.inside &&
    one.ids.length === other.ids.length &&
    one.ids.every((id, at) => other.ids[at] === id)
  )
}

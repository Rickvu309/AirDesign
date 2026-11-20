import type { ElementId } from "@airdesign/document"
import type { GestureId } from "./gestures.js"
import type { CanvasElement, CanvasSlide } from "./record.js"

export type Selection = {
  readonly ids: readonly ElementId[]
  readonly inside: ElementId | null
  readonly acrossGroups?: true
}

export const noSelection: Selection = { ids: [], inside: null }

export function leadOf(selection: Selection): ElementId | null {
  return selection.ids.at(-1) ?? null
}

function findElement(slide: CanvasSlide, id: ElementId): CanvasElement | undefined {
  return slide.elements.find((each) => each.id === id)
}

export function parentOf(slide: CanvasSlide, id: ElementId): ElementId | null {
  return findElement(slide, id)?.group?.id ?? null
}

export function ownerOf(slide: CanvasSlide, id: ElementId): ElementId {
  const element = findElement(slide, id)
  return element?.backdrop === true && element.group !== undefined ? element.group.id : id
}

function unitIn(slide: CanvasSlide, inside: ElementId | null, pressed: ElementId): ElementId {
  let unit = pressed
  for (let parent = parentOf(slide, unit); parent !== null && parent !== inside; parent = parentOf(slide, unit)) {
    unit = parent
  }
  return unit
}

export function selectionOf(slide: CanvasSlide, ids: readonly ElementId[]): Selection {
  if (ids.length === 0) return noSelection
  const parents = new Set(ids.map((id) => parentOf(slide, id)))
  if (parents.size === 1) {
    const [inside = null] = parents
    return { ids, inside }
  }
  return { ids, inside: null, acrossGroups: true }
}

export function unitOf(slide: CanvasSlide, selection: Selection, pressed: ElementId): ElementId {
  return unitIn(slide, selection.inside, ownerOf(slide, pressed))
}

export function alone(slide: CanvasSlide, id: ElementId): Selection {
  return { ids: [id], inside: parentOf(slide, id) }
}

export function picked(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection {
  return alone(slide, unitOf(slide, selection, pressed))
}

export function steppedIn(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection | null {
  if (findElement(slide, pressed)?.backdrop === true) return null
  const unit = unitOf(slide, selection, pressed)
  if (unit === pressed) return null
  return alone(slide, unitIn(slide, unit, pressed))
}

export function deepPicked(slide: CanvasSlide, pressed: ElementId): Selection {
  return alone(slide, ownerOf(slide, pressed))
}

export function toggled(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection {
  const unit = unitOf(slide, selection, pressed)
  if (selection.acrossGroups === true) {
    const ids = selection.ids.includes(unit) ? selection.ids.filter((id) => id !== unit) : [...selection.ids, unit]
    return selectionOf(slide, ids)
  }
  const inside = parentOf(slide, unit)
  if (inside !== selection.inside) return { ids: [unit], inside }
  const ids = selection.ids.includes(unit) ? selection.ids.filter((id) => id !== unit) : [...selection.ids, unit]
  return { ids, inside }
}

export function deepToggled(slide: CanvasSlide, selection: Selection, pressed: ElementId): Selection {
  const target = ownerOf(slide, pressed)
  const ids = selection.ids.includes(target) ? selection.ids.filter((id) => id !== target) : [...selection.ids, target]
  return selectionOf(slide, ids)
}

export function parentSelection(slide: CanvasSlide, selection: Selection): Selection | null {
  if (selection.ids.length === 0) return null
  if (selection.inside !== null) {
    return findElement(slide, selection.inside) === undefined ? null : alone(slide, selection.inside)
  }
  const parents: ElementId[] = []
  for (const id of selection.ids) {
    const parent = parentOf(slide, id)
    if (parent !== null && !parents.includes(parent) && findElement(slide, parent) !== undefined) parents.push(parent)
  }
  return parents.length === 0 ? null : selectionOf(slide, parents)
}

export function childrenSelection(slide: CanvasSlide, selection: Selection): Selection | null {
  if (selection.ids.length === 0) return null
  const parents = new Set(selection.ids)
  const children: ElementId[] = []
  for (const each of slide.elements) {
    if (each.id === null || each.backdrop === true) continue
    if (each.group !== undefined && parents.has(each.group.id) && !children.includes(each.id)) children.push(each.id)
  }
  return children.length === 0 ? null : selectionOf(slide, children)
}

export function siblingSelection(slide: CanvasSlide, selection: Selection, step: 1 | -1): Selection | null {
  const lead = leadOf(selection)
  const scope = selection.acrossGroups === true && lead !== null ? parentOf(slide, lead) : selection.inside
  const siblings: ElementId[] = []
  for (const each of slide.elements) {
    if (each.id === null || each.backdrop === true) continue
    if ((each.group?.id ?? null) === scope) siblings.push(each.id)
  }
  if (siblings.length === 0) return null
  const anchor = step === 1 ? lead : (selection.ids[0] ?? null)
  const current = anchor === null ? -1 : siblings.indexOf(anchor)
  const index =
    current === -1 ? (step === 1 ? 0 : siblings.length - 1) : (current + step + siblings.length) % siblings.length
  const next = siblings[index]
  return next === undefined ? null : alone(slide, next)
}

function levelOf(slide: CanvasSlide, selection: Selection): ElementId | null {
  const lead = leadOf(selection)
  return selection.acrossGroups === true && lead !== null ? parentOf(slide, lead) : selection.inside
}

function layersAt(slide: CanvasSlide, level: ElementId | null): readonly ElementId[] {
  return slide.elements.flatMap((each) =>
    each.id === null || each.backdrop === true || each.locked === true || (each.group?.id ?? null) !== level
      ? []
      : [each.id],
  )
}

export function allSelection(slide: CanvasSlide, selection: Selection): Selection {
  const level = levelOf(slide, selection)
  const ids = layersAt(slide, level)
  return ids.length === 0 ? noSelection : { ids, inside: level }
}

export function inverseSelection(slide: CanvasSlide, selection: Selection): Selection {
  const level = levelOf(slide, selection)
  const ids = layersAt(slide, level).filter((id) => !selection.ids.includes(id))
  return ids.length === 0 ? noSelection : { ids, inside: level }
}

export function keyedSelection(slide: CanvasSlide, selection: Selection, gesture: GestureId | null): Selection | null {
  if (gesture === "select-all") return allSelection(slide, selection)
  return gesture === "select-inverse" ? inverseSelection(slide, selection) : null
}

export function hoverTarget(
  slide: CanvasSlide,
  selection: Selection,
  hovered: ElementId | null,
  deep: boolean,
): ElementId | null {
  if (hovered === null) return null
  const owned = ownerOf(slide, hovered)
  const target = deep ? owned : unitOf(slide, selection, owned)
  return selection.ids.includes(target) ? null : target
}

export function focused(slide: CanvasSlide, selection: Selection, id: ElementId): Selection {
  if (selection.ids.includes(id)) {
    if (leadOf(selection) === id) return selection
    return { ...selection, ids: [...selection.ids.filter((each) => each !== id), id] }
  }
  const unit = unitOf(slide, selection, id)
  if (unit !== id && selection.ids.includes(unit)) return selection
  return alone(slide, id)
}

export function kept(selection: Selection, slide: CanvasSlide): Selection {
  const unpainted = new Set(slide.unpainted ?? [])
  const shown = new Set([...slide.elements.flatMap((each) => (each.id === null ? [] : [each.id])), ...unpainted])
  const inside = selection.inside !== null && shown.has(selection.inside) ? selection.inside : null
  const ids = selection.ids.filter(
    (id) => shown.has(id) && (selection.acrossGroups === true || unpainted.has(id) || parentOf(slide, id) === inside),
  )
  return ids.length === selection.ids.length && inside === selection.inside ? selection : { ...selection, ids, inside }
}

export function sameSelection(one: Selection, other: Selection): boolean {
  return (
    one.inside === other.inside &&
    one.acrossGroups === other.acrossGroups &&
    one.ids.length === other.ids.length &&
    one.ids.every((id, at) => other.ids[at] === id)
  )
}

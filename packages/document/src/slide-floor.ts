import { readElement, type DeckIndex, type IndexElement } from "./deck-index.js"
import { elementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { fillsElement } from "./fills-conversion.js"
import { bytesOf, limits } from "./limits.js"
import { record } from "./plain-object.js"
import { readOpening, type ElementPatch, type FieldEdit } from "./row.js"
import { slideBirths } from "./slide-births.js"
import { hasSlideNumber } from "./text-value.js"
import type { SlideCommand, SlideState } from "./slide-order.js"

type Floored = SlideState & { readonly index?: DeckIndex }

export function readFloor(raw: unknown, slide: SlideId): readonly IndexElement[] | undefined {
  if (!Array.isArray(raw) || raw.length > limits.elements) return undefined
  const slides = new Set([slide])
  const floor: IndexElement[] = []
  for (const item of raw) {
    const { opening, ...rest } = record(fillsElement(item)) ?? {}
    const element = readElement(rest, slides)
    const patch = opening === undefined ? undefined : readOpening(opening)
    if (element === null || patch === null || floor.some((kept) => kept.node === element.node)) return undefined
    floor.push(patch === undefined ? element : { ...element, opening: patch })
  }
  return floor
}

export function floorOf(command: SlideCommand): readonly IndexElement[] {
  if (command.slide === "element-add" || command.slide === "element-group") return [command.element]
  return slideBirths(command).flatMap((birth) => birth.floor ?? [])
}

export function floorFits(state: Floored, command: SlideCommand): boolean {
  if (bytesOf(JSON.stringify(command)) >= limits.row) return false
  const opened = state.order.reduce((count, kept) => count + floorOf(kept).length, state.index?.total ?? 0)
  return opened + floorOf(command).length <= limits.elements
}

export function openingElement(state: Floored, node: ElementId): IndexElement | undefined {
  const indexed = state.index?.elements.find((element) => element.node === node)
  if (indexed !== undefined || !node.includes(".")) return indexed
  const slide = shapeOf(node).slide
  for (const command of state.order) {
    const onSlide =
      command.slide === "element-add" || command.slide === "element-group"
        ? command.id === slide
        : slideBirths(command).some((birth) => birth.id === slide)
    if (!onSlide) continue
    const found = floorOf(command).find((element) => element.node === node)
    if (found !== undefined) return found
  }
  return undefined
}

export function newSlideElement(state: Floored | null, node: ElementId): IndexElement | undefined {
  if (state === null || !node.includes(".")) return undefined
  const slide = shapeOf(node).slide
  const born = state.order.some((command) => slideBirths(command).some((birth) => birth.id === slide))
  if (born) return openingElement(state, node)
  const added = state.order.find((command) => command.slide === "element-add" && command.element.node === node)
  if (added?.slide !== "element-add") return undefined
  return hasSlideNumber(added.element.value) ? added.element : undefined
}

export function floorNodes(state: Floored): readonly ElementId[] {
  return state.order.flatMap((command) => floorOf(command).map((element) => element.node))
}

function onSlide(node: ElementId, slide: SlideId): ElementId {
  return elementId(`${slide}.${shapeOf(node).shape}`)
}

export function floorFor(elements: readonly IndexElement[], slide: SlideId): readonly IndexElement[] {
  return elements.map((element) => ({
    ...element,
    node: onSlide(element.node, slide),
    ...(element.group === undefined ? {} : { group: onSlide(element.group, slide) }),
  }))
}

const carried: readonly string[] = ["box.x", "box.y", "box.w", "box.h", "text.value", "notes.value", "table.value"]

type Edits = Record<string, Record<string, FieldEdit<unknown>>>

export function floorOpening(state: Floored, node: ElementId, landed: ElementPatch): ElementPatch | undefined {
  const opening: Edits = {}
  for (const patch of [openingElement(state, node)?.opening ?? {}, landed]) {
    for (const [trait, fields] of Object.entries(patch as Readonly<Edits>)) {
      for (const [field, edit] of Object.entries(fields)) {
        if (edit === "opening" || carried.includes(`${trait}.${field}`)) continue
        opening[trait] = { ...opening[trait], [field]: edit }
      }
    }
  }
  return Object.keys(opening).length === 0 ? undefined : (opening as ElementPatch)
}

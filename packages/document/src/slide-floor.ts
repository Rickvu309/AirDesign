import { readElement, type DeckIndex, type IndexElement } from "./deck-index.js"
import { elementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { borderElement } from "./border-conversion.js"
import { fillsElement } from "./fills-conversion.js"
import { templateStyleElement } from "./template-style-conversion.js"
import { overlayElement } from "./overlay-conversion.js"
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
    const { opening, ...rest } = record(overlayElement(templateStyleElement(borderElement(fillsElement(item))))) ?? {}
    const element = readElement(rest, slides)
    const patch = opening === undefined ? undefined : readOpening(opening)
    if (element === null || patch === null || floor.some((kept) => kept.node === element.node)) return undefined
    floor.push(patch === undefined ? element : { ...element, opening: patch })
  }
  return floor
}

export function floorOf(command: SlideCommand): readonly IndexElement[] {
  if (command.slide === "element-add")
    return [command.element, ...(command.pasted?.layers ?? []).map((layer) => layer.element)]
  if (command.slide === "element-clone")
    return [command.element, ...(command.layers ?? []).map((layer) => layer.element)]
  if (command.slide === "element-group")
    return command.backdrop === undefined ? [command.element] : [command.element, command.backdrop]
  return slideBirths(command).flatMap((birth) => birth.floor ?? [])
}

export function floorFits(state: Floored, command: SlideCommand): boolean {
  if (bytesOf(JSON.stringify(command)) >= limits.row) return false
  const opened = state.order.reduce((count, kept) => count + floorOf(kept).length, state.index?.total ?? 0)
  return opened + floorOf(command).length <= limits.elements
}

type FloorIndex = {
  readonly opening: ReadonlyMap<ElementId, IndexElement>
  readonly bornSlides: ReadonlySet<string>
  readonly clonedElement: ReadonlyMap<ElementId, IndexElement>
  readonly addedElement: ReadonlyMap<ElementId, IndexElement>
  readonly clonedLayers: ReadonlyMap<ElementId, IndexElement>
}

const floorIndexes = new WeakMap<readonly SlideCommand[], WeakMap<object, FloorIndex>>()
const noFloorIndex = {}

function buildFloorIndex(state: Floored): FloorIndex {
  const opening = new Map<ElementId, IndexElement>()
  const bornSlides = new Set<string>()
  const clonedElement = new Map<ElementId, IndexElement>()
  const addedElement = new Map<ElementId, IndexElement>()
  const clonedLayers = new Map<ElementId, IndexElement>()
  for (const element of state.index?.elements ?? []) {
    if (!opening.has(element.node)) opening.set(element.node, element)
  }
  for (const command of state.order) {
    const direct =
      command.slide === "element-add" || command.slide === "element-clone" || command.slide === "element-group"
    let bornOnCommand: Set<string> | null = null
    if (!direct) {
      const births = slideBirths(command)
      if (births.length > 0) {
        bornOnCommand = new Set<string>()
        for (const birth of births) {
          bornSlides.add(birth.id)
          bornOnCommand.add(birth.id)
        }
      }
    }
    if (direct || bornOnCommand !== null) {
      for (const element of floorOf(command)) {
        if (!element.node.includes(".") || opening.has(element.node)) continue
        const slide = shapeOf(element.node).slide
        if (direct ? command.id === slide : bornOnCommand!.has(slide)) opening.set(element.node, element)
      }
    }
    if (command.slide === "element-clone") {
      if (!clonedElement.has(command.element.node)) clonedElement.set(command.element.node, command.element)
      for (const layer of command.layers ?? []) {
        if (!clonedLayers.has(layer.element.node)) clonedLayers.set(layer.element.node, layer.element)
      }
    } else if (command.slide === "element-add") {
      if (!addedElement.has(command.element.node)) addedElement.set(command.element.node, command.element)
    }
  }
  return { opening, bornSlides, clonedElement, addedElement, clonedLayers }
}

function floorIndexOf(state: Floored): FloorIndex {
  let byIndex = floorIndexes.get(state.order)
  if (byIndex === undefined) {
    byIndex = new WeakMap<object, FloorIndex>()
    floorIndexes.set(state.order, byIndex)
  }
  const key = state.index ?? noFloorIndex
  const kept = byIndex.get(key)
  if (kept !== undefined) return kept
  const built = buildFloorIndex(state)
  byIndex.set(key, built)
  return built
}

export function openingElement(state: Floored, node: ElementId): IndexElement | undefined {
  return floorIndexOf(state).opening.get(node)
}

export function newSlideElement(state: Floored | null, node: ElementId): IndexElement | undefined {
  if (state === null || !node.includes(".")) return undefined
  const index = floorIndexOf(state)
  if (index.bornSlides.has(shapeOf(node).slide)) return index.opening.get(node)
  const cloned = index.clonedElement.get(node)
  if (cloned !== undefined) return cloned
  const added = index.addedElement.get(node)
  return added !== undefined && hasSlideNumber(added.value) ? added : undefined
}

export function clonedLayer(state: Floored, node: ElementId): IndexElement | undefined {
  return floorIndexOf(state).clonedLayers.get(node)
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

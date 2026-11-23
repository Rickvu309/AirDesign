import { type DeckIndex, type IndexElement } from "./deck-index.js"
import { shapeOf, type ElementId } from "./element-id.js"
import { slideBirths } from "./slide-births.js"
import type { SlideCommand, SlideState } from "./slide-order.js"

type Floored = SlideState & { readonly index?: DeckIndex }

export function floorOf(command: SlideCommand): readonly IndexElement[] {
  if (command.slide === "element-add")
    return [command.element, ...(command.pasted?.layers ?? []).map((layer) => layer.element)]
  if (command.slide === "element-clone")
    return [command.element, ...(command.layers ?? []).map((layer) => layer.element)]
  if (command.slide === "element-group")
    return command.backdrop === undefined ? [command.element] : [command.element, command.backdrop]
  return slideBirths(command).flatMap((birth) => birth.floor ?? [])
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

import { readElement, type DeckIndex, type IndexElement } from "./deck-index.js"
import { elementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { bytesOf, limits } from "./limits.js"
import type { SlideCommand, SlideState } from "./slide-order.js"

type Floored = SlideState & { readonly index?: DeckIndex }

export function readFloor(raw: unknown, slide: SlideId): readonly IndexElement[] | undefined {
  if (!Array.isArray(raw) || raw.length > limits.elements) return undefined
  const slides = new Set([slide])
  const floor: IndexElement[] = []
  for (const item of raw) {
    const element = readElement(item, slides)
    if (element === null || floor.some((kept) => kept.node === element.node)) return undefined
    floor.push(element)
  }
  return floor
}

export function floorOf(command: SlideCommand): readonly IndexElement[] {
  if (command.slide === "add" || command.slide === "clone") return command.floor ?? []
  return []
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
  const born = state.order.find(
    (command) => command.id === slide && (command.slide === "add" || command.slide === "clone"),
  )
  return born === undefined ? undefined : floorOf(born).find((element) => element.node === node)
}

export function floorNodes(state: Floored): readonly ElementId[] {
  return state.order.flatMap((command) => floorOf(command).map((element) => element.node))
}

export function floorFor(elements: readonly IndexElement[], slide: SlideId): readonly IndexElement[] {
  return elements.map((element) => ({ ...element, node: elementId(`${slide}.${shapeOf(element.node).shape}`) }))
}

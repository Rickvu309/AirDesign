import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { openingElement, readFloor } from "./slide-floor.js"
import type { SlideState } from "./slide-order.js"

export type ElementAdd = {
  readonly slide: "element-add"
  readonly id: SlideId
  readonly element: IndexElement
}

export type ElementRemove = {
  readonly slide: "element-remove"
  readonly id: SlideId
  readonly node: ElementId
}

export type ElementRestore = {
  readonly slide: "element-restore"
  readonly id: SlideId
  readonly node: ElementId
}

export type ElementCommand = ElementAdd | ElementRemove | ElementRestore

export function elementCommand(command: { readonly slide: string }): command is ElementCommand {
  return command.slide === "element-add" || command.slide === "element-remove" || command.slide === "element-restore"
}

type Indexed = SlideState & { readonly index?: DeckIndex }

const highestShape = 4294967295

export function elementGone(state: SlideState, node: ElementId): boolean {
  let gone = false
  for (const command of state.order) {
    if (command.slide === "element-remove" && command.node === node) gone = true
    if (command.slide === "element-restore" && command.node === node) gone = false
  }
  return gone
}

function shapeNumber(node: ElementId): number {
  return Number(shapeOf(node).shape)
}

export function nextElementId(state: SlideState, slide: SlideId, free: number): ElementId {
  let next = free
  for (const command of state.order) {
    if (command.id !== slide) continue
    if (command.slide === "element-add") next = Math.max(next, shapeNumber(command.element.node) + 1)
    if (command.slide === "element-remove" || command.slide === "element-restore")
      next = Math.max(next, shapeNumber(command.node) + 1)
  }
  return elementId(`${slide}.${String(next)}`)
}

function textBox(element: IndexElement): boolean {
  const number = shapeNumber(element.node)
  return (
    Number.isInteger(number) &&
    number > 1 &&
    number <= highestShape &&
    element.kind === "shape" &&
    element.box !== null &&
    element.value === "" &&
    !element.grouped
  )
}

function indexComplete(state: Indexed): boolean {
  return state.index !== undefined && state.index.total === state.index.elements.length
}

export function elementRefusal(state: Indexed, command: ElementCommand): "dead" | "present" | "group-box" | null {
  const node = command.slide === "element-add" ? command.element.node : command.node
  if (shapeOf(node).slide !== command.id) return "dead"
  const opening = openingElement(state, node)
  if (command.slide === "element-add") {
    if (opening !== undefined || elementGone(state, node)) return "present"
    return textBox(command.element) ? null : "dead"
  }
  if (command.slide === "element-restore") return elementGone(state, node) ? null : "dead"
  if (elementGone(state, node)) return "dead"
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  return opening.grouped || opening.kind === "group" ? "group-box" : null
}

export function readElementCommand(raw: Record<string, unknown>, id: SlideId): ElementCommand | undefined {
  if (raw.slide === "element-add") {
    const element = readFloor([raw.element], id)?.[0]
    return element === undefined ? undefined : { slide: "element-add", id, element }
  }
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  return raw.slide === "element-restore"
    ? { slide: "element-restore", id, node }
    : { slide: "element-remove", id, node }
}

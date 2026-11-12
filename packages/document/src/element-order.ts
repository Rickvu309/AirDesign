import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { onlyKeys, record } from "./plain-object.js"
import { openingElement, readFloor } from "./slide-floor.js"
import type { SlideState } from "./slide-order.js"

export const mediaTypes = ["image/png", "image/jpeg", "image/gif"] as const

export type MediaType = (typeof mediaTypes)[number]

export type Media = { readonly sha256: string; readonly type: MediaType }

export type ElementAdd = {
  readonly slide: "element-add"
  readonly id: SlideId
  readonly element: IndexElement
  readonly media?: Media
}

export type ElementRemove = {
  readonly slide: "element-remove"
  readonly id: SlideId
  readonly node: ElementId
}

export type ElementCommand = ElementAdd | ElementRemove

type Indexed = SlideState & { readonly index?: DeckIndex }

const highestShape = 4294967295

export function elementGone(state: SlideState, node: ElementId): boolean {
  return state.order.some((command) => command.slide === "element-remove" && command.node === node)
}

function shapeNumber(node: ElementId): number {
  return Number(shapeOf(node).shape)
}

export function nextElementId(state: SlideState, slide: SlideId, free: number): ElementId {
  let next = free
  for (const command of state.order) {
    if (command.id !== slide) continue
    if (command.slide === "element-add") next = Math.max(next, shapeNumber(command.element.node) + 1)
    if (command.slide === "element-remove") next = Math.max(next, shapeNumber(command.node) + 1)
  }
  return elementId(`${slide}.${String(next)}`)
}

function freshShape(element: IndexElement): boolean {
  const number = shapeNumber(element.node)
  return Number.isInteger(number) && number > 1 && number <= highestShape && element.box !== null && !element.grouped
}

function addable(command: ElementAdd): boolean {
  const { element, media } = command
  if (!freshShape(element)) return false
  if (element.kind === "shape") return element.value === "" && media === undefined
  const sized = element.box !== null && element.box.cx > 0 && element.box.cy > 0
  return element.kind === "picture" && element.value === null && sized && media !== undefined
}

export function addedPictures(state: SlideState): readonly Media[] {
  const found = new Map<string, Media>()
  for (const command of state.order) {
    if (command.slide === "element-add" && command.media !== undefined) found.set(command.media.sha256, command.media)
  }
  return [...found.values()]
}

function readMedia(raw: unknown): Media | undefined {
  const row = record(raw)
  if (row === null || !onlyKeys(row, ["sha256", "type"])) return undefined
  if (typeof row.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.sha256)) return undefined
  const type = mediaTypes.find((each) => each === row.type)
  return type === undefined ? undefined : { sha256: row.sha256, type }
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
    return addable(command) ? null : "dead"
  }
  if (elementGone(state, node)) return "dead"
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  return opening.grouped || opening.kind === "group" ? "group-box" : null
}

export function readElementCommand(raw: Record<string, unknown>, id: SlideId): ElementCommand | undefined {
  if (raw.slide === "element-add") {
    const element = readFloor([raw.element], id)?.[0]
    if (element === undefined) return undefined
    if (raw.media === undefined) return { slide: "element-add", id, element }
    const media = readMedia(raw.media)
    return media === undefined ? undefined : { slide: "element-add", id, element, media }
  }
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  return { slide: "element-remove", id, node }
}

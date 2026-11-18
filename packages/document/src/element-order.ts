import { assetIcon, mediaTypes, type Media } from "./asset-ref.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { onlyKeys, record } from "./plain-object.js"
import { openingElement, readFloor } from "./slide-floor.js"
import { slideMeasure } from "./slide-measure.js"
import { presets, type Preset } from "./trait-geometry.js"
import type { SlideState } from "./slide-order.js"
import { openedTable } from "./table-value.js"
import { indexFacts, removable } from "./element-takes.js"
import { groupedNow } from "./element-group.js"

export const geometries = presets

export type Geometry = Preset

export const lineGeometries: readonly Geometry[] = ["line", "straightConnector1"]

export type ElementAdd = {
  readonly slide: "element-add"
  readonly id: SlideId
  readonly element: IndexElement
  readonly media?: Media
  readonly geometry?: Geometry
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

export type ElementOrder = {
  readonly slide: "element-order"
  readonly id: SlideId
  readonly node: ElementId
  readonly before: ElementId | null
  readonly among: readonly ElementId[]
}

export type ElementCommand = ElementAdd | ElementRemove | ElementRestore | ElementOrder

export function elementCommand(command: { readonly slide: string }): command is ElementCommand {
  return (
    command.slide === "element-add" ||
    command.slide === "element-remove" ||
    command.slide === "element-restore" ||
    command.slide === "element-order"
  )
}

type Indexed = SlideState & { readonly index?: DeckIndex }

const highestShape = 4294967295

function removedNow(state: SlideState, node: ElementId): boolean {
  let gone = false
  for (const command of state.order) {
    if (command.slide === "element-remove" && command.node === node) gone = true
    if (command.slide === "element-restore" && command.node === node) gone = false
  }
  return gone
}

export function elementGone(state: SlideState, node: ElementId): boolean {
  let gone = false
  for (const command of state.order) {
    if ((command.slide === "element-remove" || command.slide === "element-ungroup") && command.node === node)
      gone = true
    if ((command.slide === "element-restore" || command.slide === "element-regroup") && command.node === node)
      gone = false
  }
  return gone
}

function shapeNumber(node: ElementId): number {
  return Number(shapeOf(node).shape)
}

export function nextElementId(state: SlideState, slide: SlideId, free: number): ElementId {
  let next = free
  for (const command of state.order) {
    if (!("id" in command) || command.id !== slide) continue
    if (command.slide === "element-add" || command.slide === "element-group")
      next = Math.max(next, shapeNumber(command.element.node) + 1)
    if (command.slide === "element-remove" || command.slide === "element-restore")
      next = Math.max(next, shapeNumber(command.node) + 1)
  }
  return elementId(`${slide}.${String(next)}`)
}

function freshShape(element: IndexElement): boolean {
  const number = shapeNumber(element.node)
  return Number.isInteger(number) && number > 1 && number <= highestShape && element.box !== null && !element.grouped
}

function drawable(element: IndexElement, geometry: Geometry): boolean {
  const { box } = element
  if (box === null || element.value !== null || !geometries.includes(geometry)) return false
  if (lineGeometries.includes(geometry))
    return element.kind === "connector" && box.cx >= 0 && box.cy >= 0 && box.cx + box.cy > 0
  return element.kind === "shape" && box.cx > 0 && box.cy > 0
}

function addable(command: ElementAdd): boolean {
  const { element, media, geometry } = command
  if (!freshShape(element)) return false
  if (geometry !== undefined) return media === undefined && drawable(element, geometry)
  if (element.kind === "table") return media === undefined && openedTable(element.value)
  if (element.kind === "shape") return element.value === "" && media === undefined
  const sized = element.box !== null && element.box.cx > 0 && element.box.cy > 0
  const sourced = (media !== undefined) !== (openingIcon(element) !== null)
  return element.kind === "picture" && element.value === null && sized && sourced
}

export function openingIcon(element: IndexElement): string | null {
  const source = element.opening?.image?.source
  return source !== undefined && typeof source === "object" ? assetIcon(source.set) : null
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

export function elementRefusal(
  state: Indexed,
  command: Exclude<ElementCommand, ElementOrder>,
): "dead" | "present" | "group-box" | "locked" | "kind" | null {
  const node = command.slide === "element-add" ? command.element.node : command.node
  if (shapeOf(node).slide !== command.id) return "dead"
  const opening = openingElement(state, node)
  if (command.slide === "element-add") {
    if (opening !== undefined || elementGone(state, node)) return "present"
    return addable(command) ? null : "dead"
  }
  if (command.slide === "element-restore") return removedNow(state, node) ? null : "dead"
  if (elementGone(state, node)) return "dead"
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  const animated = slideMeasure(state, command.id)?.animated.includes(shapeOf(node).shape) === true
  const grouped = groupedNow(state, node)
  if (removable({ ...indexFacts(opening, animated), grouped })) return null
  if (grouped || opening.kind === "group") return "group-box"
  return animated ? "locked" : "kind"
}

export function readElementCommand(raw: Record<string, unknown>, id: SlideId): ElementCommand | undefined {
  if (raw.slide === "element-add") {
    const element = readFloor([raw.element], id)?.[0]
    if (element === undefined) return undefined
    if (raw.geometry !== undefined) {
      const geometry = geometries.find((each) => each === raw.geometry)
      return geometry === undefined || raw.media !== undefined
        ? undefined
        : { slide: "element-add", id, element, geometry }
    }
    if (raw.media === undefined) return { slide: "element-add", id, element }
    const media = readMedia(raw.media)
    return media === undefined ? undefined : { slide: "element-add", id, element, media }
  }
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  return raw.slide === "element-restore"
    ? { slide: "element-restore", id, node }
    : { slide: "element-remove", id, node }
}

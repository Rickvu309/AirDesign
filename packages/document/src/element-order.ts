import { assetIcon, readMedia, type Media } from "./asset-ref.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { elementId, readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { limits } from "./limits.js"
import { onlyKeys, record } from "./plain-object.js"
import { floorOf, openingElement, readFloor } from "./slide-floor.js"
import { slideMeasure } from "./slide-measure.js"
import { presets, type Preset } from "./trait-geometry.js"
import type { SlideState } from "./slide-order.js"
import { hasSlideNumber, openingSlideNumber } from "./text-value.js"
import { openedTable } from "./table-value.js"
import { indexFacts, removable } from "./element-takes.js"
import { frameBackdrop, groupChildren, groupedNow, groupEmptied, groupParent, plainGroup } from "./element-group.js"
import type { Kind } from "./kinds.js"
import { pastedFits, pastedNodes, readPasted, type PastedLayers } from "./pasted-layers.js"

export const geometries = presets

export type Geometry = Preset

export const lineGeometries: readonly Geometry[] = ["line", "straightConnector1"]

export type ElementAdd = {
  readonly slide: "element-add"
  readonly id: SlideId
  readonly element: IndexElement
  readonly media?: Media
  readonly geometry?: Geometry
  readonly pasted?: PastedLayers
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

export type ClonedLayer = { readonly source: ElementId; readonly element: IndexElement }

export type ElementClone = {
  readonly slide: "element-clone"
  readonly id: SlideId
  readonly source: ElementId
  readonly element: IndexElement
  readonly layers?: readonly ClonedLayer[]
}

export type ElementCommand = ElementAdd | ElementClone | ElementRemove | ElementRestore | ElementOrder

export const clonedKinds: readonly Kind[] = ["shape", "connector", "group"]

export function elementCommand(command: { readonly slide: string }): command is ElementCommand {
  return (
    command.slide === "element-add" ||
    command.slide === "element-clone" ||
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

const backdrops = new WeakMap<DeckIndex, ReadonlyMap<ElementId, ElementId>>()

function filedBackdrops(index: DeckIndex): ReadonlyMap<ElementId, ElementId> {
  const kept = backdrops.get(index)
  if (kept !== undefined) return kept
  const found = new Map<ElementId, ElementId>()
  for (const element of index.elements)
    if (element.framing !== undefined) found.set(element.framing.backdrop, element.node)
  backdrops.set(index, found)
  return found
}

export function elementGone(state: SlideState, node: ElementId): boolean {
  let gone = false
  let frame: ElementId | null = state.index === undefined ? null : (filedBackdrops(state.index).get(node) ?? null)
  for (const command of state.order) {
    if (command.slide === "element-group" && command.backdrop?.node === node) frame = command.element.node
    if (command.slide === "element-clone" && command.layers?.some((layer) => layer.element.node === node))
      frame = command.element.node
    if (command.slide === "element-add" && pastedNodes(command.pasted).includes(node)) frame = command.element.node
    const named = "node" in command && (command.node === node || command.node === frame)
    if ((command.slide === "element-remove" || command.slide === "element-ungroup") && named) gone = true
    if ((command.slide === "element-restore" || command.slide === "element-regroup") && named) gone = false
  }
  return gone
}

function shapeNumber(node: ElementId): number {
  return Number(shapeOf(node).shape)
}

function elementNames(element: IndexElement): readonly ElementId[] {
  return element.framing === undefined ? [element.node] : [element.node, element.framing.backdrop]
}

function namedElements(state: Indexed): readonly ElementId[] {
  const filed = (state.index?.elements ?? []).flatMap(elementNames)
  const ordered = state.order.flatMap((command) => [
    ...floorOf(command).flatMap(elementNames),
    ...("node" in command ? [command.node] : []),
  ])
  return [...filed, ...ordered]
}

export function nextElementId(state: Indexed, slide: SlideId, free: number): ElementId {
  let next = free
  for (const node of namedElements(state)) {
    const number = shapeNumber(node)
    if (shapeOf(node).slide === slide && Number.isInteger(number)) next = Math.max(next, number + 1)
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
  const { element, media, geometry, pasted } = command
  if (!freshShape(element)) return false
  if (pasted !== undefined)
    return media === undefined && geometry === undefined && pastedFits(element, pasted, command.id)
  if (geometry !== undefined) return media === undefined && drawable(element, geometry)
  if (element.kind === "table") return media === undefined && openedTable(element.value)
  if (element.kind !== "shape") return false
  if (element.value !== null) return (element.value === "" || openingSlideNumber(element.value)) && media === undefined
  const sized = element.box !== null && element.box.cx > 0 && element.box.cy > 0
  return sized && (media !== undefined) !== (openingIcon(element) !== null)
}

export function openingIcon(element: IndexElement): string | null {
  const source = element.opening?.fills?.source
  return source !== undefined && typeof source === "object" ? assetIcon(source.set) : null
}

export function addedPictures(state: SlideState): readonly Media[] {
  const found = new Map<string, Media>()
  for (const command of state.order) {
    if (command.slide !== "element-add") continue
    for (const media of [...(command.media === undefined ? [] : [command.media]), ...(command.pasted?.media ?? [])])
      found.set(media.sha256, media)
  }
  return [...found.values()]
}

function indexComplete(state: Indexed): boolean {
  return state.index !== undefined && state.index.total === state.index.elements.length
}

type Refusal = "dead" | "present" | "group-box" | "locked" | "kind"

export type CloneRefusal = Exclude<Refusal, "locked">

function freshCopy(state: Indexed, element: IndexElement, id: SlideId): CloneRefusal | null {
  const number = shapeNumber(element.node)
  if (shapeOf(element.node).slide !== id) return "dead"
  if (openingElement(state, element.node) !== undefined || elementGone(state, element.node)) return "present"
  if (!Number.isInteger(number) || number <= 1 || number > highestShape || element.box === null) return "dead"
  if (hasSlideNumber(element.value)) return "present"
  return clonedKinds.includes(element.kind) ? null : "kind"
}

function copiedFrom(state: Indexed, source: ElementId, element: IndexElement): CloneRefusal | null {
  const opening = openingElement(state, source)
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  return opening.kind === element.kind ? null : "kind"
}

function layersRefusal(state: Indexed, command: ElementClone): CloneRefusal | null {
  const copies = new Map<ElementId, ElementId>([[command.source, command.element.node]])
  for (const layer of command.layers ?? []) {
    if (shapeOf(layer.source).slide !== shapeOf(command.source).slide) return "dead"
    const parent = groupParent(state, layer.source)
    const above = typeof parent === "string" ? copies.get(parent) : undefined
    if (above === undefined || copies.has(layer.source) || layer.element.group !== above) return "dead"
    if (!layer.element.grouped || [...copies.values()].includes(layer.element.node)) return "dead"
    const refusal = freshCopy(state, layer.element, command.id) ?? copiedFrom(state, layer.source, layer.element)
    if (refusal !== null) return refusal
    copies.set(layer.source, layer.element.node)
  }
  const held = (group: ElementId): readonly ElementId[] =>
    groupChildren(state, group).flatMap((child) => (elementGone(state, child) ? [] : [child, ...held(child)]))
  return held(command.source).every((child) => copies.has(child)) ? null : "kind"
}

export function cloneRefusal(state: Indexed, command: ElementClone): CloneRefusal | null {
  const { element, source } = command
  const fresh = freshCopy(state, element, command.id) ?? copiedFrom(state, source, element)
  if (fresh !== null) return fresh
  const parent = shapeOf(source).slide === command.id ? groupParent(state, source) : null
  if (parent === undefined) return indexComplete(state) ? "dead" : null
  if (parent !== null && (!plainGroup(state, parent) || element.group !== parent || !element.grouped))
    return "group-box"
  if (parent === null && element.grouped) return "dead"
  return layersRefusal(state, command)
}

function copied(state: Indexed, node: ElementId): boolean {
  return state.order.some(
    (command) =>
      (command.slide === "element-clone" || (command.slide === "element-add" && command.pasted !== undefined)) &&
      command.element.node === node,
  )
}

export function elementRefusal(state: Indexed, command: Exclude<ElementCommand, ElementOrder>): Refusal | null {
  if (command.slide === "element-clone") return cloneRefusal(state, command)
  const node = command.slide === "element-add" ? command.element.node : command.node
  if (shapeOf(node).slide !== command.id) return "dead"
  const opening = openingElement(state, node)
  if (command.slide === "element-add") {
    const taken = (each: ElementId) => openingElement(state, each) !== undefined || elementGone(state, each)
    if (opening !== undefined || elementGone(state, node) || pastedNodes(command.pasted).some(taken)) return "present"
    if (hasSlideNumber(command.element.value)) {
      const numbered = (element: IndexElement) =>
        shapeOf(element.node).slide === command.id && hasSlideNumber(element.value) && !elementGone(state, element.node)
      if (state.index?.elements.some(numbered) || state.order.some((edit) => floorOf(edit).some(numbered)))
        return "present"
    }
    return addable(command) ? null : "dead"
  }
  if (command.slide === "element-restore") return removedNow(state, node) ? null : "dead"
  if (elementGone(state, node)) return "dead"
  if (opening === undefined) return indexComplete(state) ? "dead" : null
  if (copied(state, node)) return null
  const animated = slideMeasure(state, command.id)?.animated.includes(shapeOf(node).shape) === true
  if (groupEmptied(state, node)) return animated ? "locked" : null
  const parent = groupParent(state, node)
  const backdrop = parent === null || parent === undefined ? null : frameBackdrop(state, parent)
  const grouped = groupedNow(state, node) && (backdrop === null || backdrop === node)
  if (removable({ ...indexFacts(opening, animated), grouped })) return null
  if (grouped || opening.kind === "group") return "group-box"
  return animated ? "locked" : "kind"
}

function readLayers(raw: unknown, id: SlideId, from: string): readonly ClonedLayer[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > limits.elements) return undefined
  const layers: ClonedLayer[] = []
  for (const item of raw) {
    const row = record(item)
    if (row === null || !onlyKeys(row, ["source", "element"])) return undefined
    const source = readElementId(row.source)
    const element = readFloor([row.element], id)?.[0]
    if (source === undefined || element === undefined || shapeOf(source).slide !== from) return undefined
    layers.push({ source, element })
  }
  return layers
}

export function readElementCommand(raw: Record<string, unknown>, id: SlideId): ElementCommand | undefined {
  if (raw.slide === "element-clone") {
    const element = readFloor([raw.element], id)?.[0]
    const source = readElementId(raw.source)
    if (element === undefined || source === undefined) return undefined
    if (raw.layers === undefined) return { slide: "element-clone", id, source, element }
    const layers = readLayers(raw.layers, id, shapeOf(source).slide)
    return layers === undefined ? undefined : { slide: "element-clone", id, source, element, layers }
  }
  if (raw.slide === "element-add") {
    const element = readFloor([raw.element], id)?.[0]
    if (element === undefined) return undefined
    if (raw.pasted !== undefined) {
      const pasted = readPasted(raw.pasted, id)
      if (pasted === undefined || raw.media !== undefined || raw.geometry !== undefined) return undefined
      return { slide: "element-add", id, element, pasted }
    }
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

import { assetIcon, type Media } from "./asset-ref.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { type ElementId, type SlideId } from "./element-id.js"
import { type Preset } from "./trait-geometry.js"
import type { SlideState } from "./slide-order.js"
import { groupParent } from "./element-group.js"
import { pastedNodes, type PastedLayers } from "./pasted-layers.js"

const connectorGeometries = ["bentConnector3"] as const

export type Geometry = Preset | (typeof connectorGeometries)[number]

export const lineGeometries: readonly Geometry[] = ["line", "straightConnector1", ...connectorGeometries]

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

type ElementLife = {
  readonly removed: ReadonlySet<ElementId>
  readonly ownGone: ReadonlySet<ElementId>
}

const backdrops = new WeakMap<DeckIndex, ReadonlyMap<ElementId, ElementId>>()
const lives = new WeakMap<readonly unknown[], WeakMap<object, ElementLife>>()
const noLifeIndex = {}

function filedBackdrops(index: DeckIndex): ReadonlyMap<ElementId, ElementId> {
  const kept = backdrops.get(index)
  if (kept !== undefined) return kept
  const found = new Map<ElementId, ElementId>()
  for (const element of index.elements)
    if (element.framing !== undefined) found.set(element.framing.backdrop, element.node)
  backdrops.set(index, found)
  return found
}

function foldLife(state: Indexed): ElementLife {
  const removed = new Set<ElementId>()
  const ownGone = new Set<ElementId>()
  const frameOf = new Map<ElementId, ElementId>()
  const childrenOfFrame = new Map<ElementId, Set<ElementId>>()
  const attach = (child: ElementId, frame: ElementId) => {
    const previous = frameOf.get(child)
    if (previous !== undefined) childrenOfFrame.get(previous)?.delete(child)
    frameOf.set(child, frame)
    let group = childrenOfFrame.get(frame)
    if (group === undefined) {
      group = new Set<ElementId>()
      childrenOfFrame.set(frame, group)
    }
    group.add(child)
  }
  if (state.index !== undefined) {
    for (const [backdrop, frame] of filedBackdrops(state.index)) attach(backdrop, frame)
  }
  for (const command of state.order) {
    if (command.slide === "element-group" && command.backdrop !== undefined)
      attach(command.backdrop.node, command.element.node)
    if (command.slide === "element-clone" && command.layers !== undefined)
      for (const layer of command.layers) attach(layer.element.node, command.element.node)
    if (command.slide === "element-add" && command.pasted !== undefined)
      for (const child of pastedNodes(command.pasted)) attach(child, command.element.node)
    if (!("node" in command)) continue
    const target = command.node
    if (command.slide === "element-remove") removed.add(target)
    if (command.slide === "element-restore") removed.delete(target)
    if (command.slide === "element-remove" || command.slide === "element-ungroup") {
      ownGone.add(target)
      const children = childrenOfFrame.get(target)
      if (children !== undefined) for (const child of children) ownGone.add(child)
    }
    if (command.slide === "element-restore" || command.slide === "element-regroup") {
      ownGone.delete(target)
      const children = childrenOfFrame.get(target)
      if (children !== undefined) for (const child of children) ownGone.delete(child)
    }
  }
  return { removed, ownGone }
}

function lifeOf(state: Indexed): ElementLife {
  let byIndex = lives.get(state.order)
  if (byIndex === undefined) {
    byIndex = new WeakMap<object, ElementLife>()
    lives.set(state.order, byIndex)
  }
  const key = state.index ?? noLifeIndex
  const kept = byIndex.get(key)
  if (kept !== undefined) return kept
  const built = foldLife(state)
  byIndex.set(key, built)
  return built
}

function inRemovedGroup(state: Indexed, node: ElementId): boolean {
  const { removed } = lifeOf(state)
  if (removed.size === 0) return false
  for (let above = groupParent(state, node); typeof above === "string"; above = groupParent(state, above))
    if (removed.has(above)) return true
  return false
}

export function elementGone(state: SlideState, node: ElementId): boolean {
  return lifeOf(state).ownGone.has(node) || inRemovedGroup(state, node)
}

export function openingIcon(element: IndexElement): string | null {
  const source = element.opening?.fills?.source
  return source !== undefined && typeof source === "object" ? assetIcon(source.set) : null
}

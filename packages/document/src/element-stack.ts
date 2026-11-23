import type { DeckIndex } from "./deck-index.js"
import { readElementId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { groupCommand, groupParent } from "./element-group.js"
import { elementGone, type ElementOrder } from "./element-order.js"
import { limits } from "@airdesign/doom"
import type { SlideState } from "./slide-order.js"
import { openingElement } from "./slide-floor.js"

type Indexed = SlideState & { readonly index?: DeckIndex }

type Held = { readonly node: ElementId; readonly before: ElementId | null }

type Chain = {
  slide: SlideId
  ids: ElementId[]
  held: Held[]
  acceptsAdds: boolean
}

export type ElementStack = { readonly slide: SlideId; readonly ids: readonly ElementId[] }

export type StackMove = "front" | "forward" | "backward" | "back"

export function sitsBefore(among: readonly ElementId[], node: ElementId): ElementId | null | undefined {
  const at = among.indexOf(node)
  if (at < 0) return undefined
  return among[at + 1] ?? null
}

export function stackTarget(
  among: readonly ElementId[],
  node: ElementId,
  move: StackMove,
): ElementId | null | undefined {
  const at = among.indexOf(node)
  if (at < 0) return undefined
  if (move === "front") return at === among.length - 1 ? undefined : null
  if (move === "back") return at === 0 ? undefined : among[0]
  if (move === "backward") return at === 0 ? undefined : among[at - 1]
  return among[at + 1] === undefined ? undefined : (among[at + 2] ?? null)
}

function sameIds(left: readonly ElementId[], right: readonly ElementId[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

function moved(among: readonly ElementId[], node: ElementId, before: ElementId | null): ElementId[] {
  const rest = among.filter((id) => id !== node)
  if (before === null) return [...rest, node]
  const at = rest.indexOf(before)
  if (at < 0) return [...rest, node]
  return [...rest.slice(0, at), node, ...rest.slice(at)]
}

function placed(ids: readonly ElementId[], node: ElementId, before: ElementId | null): ElementId[] {
  if (ids.includes(node)) return [...ids]
  if (before === null || !ids.includes(before)) return [...ids, node]
  const at = ids.indexOf(before)
  return [...ids.slice(0, at), node, ...ids.slice(at)]
}

function indexComplete(state: Indexed): boolean {
  return state.index !== undefined && state.index.total === state.index.elements.length
}

function knownNode(state: Indexed, node: ElementId): boolean {
  if (openingElement(state, node) !== undefined) return true
  return !indexComplete(state)
}

function acceptsAdds(among: readonly ElementId[], index: DeckIndex | undefined): boolean {
  if (index === undefined) return true
  return among.some((node) => {
    const row = index.elements.find((element) => element.node === node)
    return row === undefined || !row.grouped
  })
}

function take(chains: Chain[], slide: SlideId, among: readonly ElementId[]): Chain | "stale" | null {
  const hit = chains.filter((chain) => chain.slide === slide && chain.ids.some((id) => among.includes(id)))
  const chain = hit[0]
  if (hit.length > 1 || (chain !== undefined && !sameIds(chain.ids, among))) return "stale"
  return chain ?? null
}

function fold(state: Indexed): Chain[] {
  let chains: Chain[] = []
  for (const command of state.order) {
    if (groupCommand(command)) {
      chains = chains.filter((chain) => chain.slide !== command.id)
      continue
    }
    if (command.slide === "element-add") {
      for (const chain of chains) {
        if (chain.slide !== command.id || !chain.acceptsAdds || chain.ids.includes(command.element.node)) continue
        chain.ids = [...chain.ids, command.element.node]
      }
      continue
    }
    if (command.slide === "element-clone") {
      for (const chain of chains) {
        const at = chain.ids.indexOf(command.source)
        if (chain.slide !== command.id || at < 0 || chain.ids.includes(command.element.node)) continue
        chain.ids = [...chain.ids.slice(0, at + 1), command.element.node, ...chain.ids.slice(at + 1)]
      }
      continue
    }
    if (command.slide === "element-remove") {
      for (const chain of chains) {
        const at = chain.ids.indexOf(command.node)
        if (at < 0) continue
        const before = chain.ids[at + 1] ?? null
        chain.ids = chain.ids.filter((id) => id !== command.node)
        chain.held = [...chain.held, { node: command.node, before }]
      }
      continue
    }
    if (command.slide === "element-restore") {
      for (const chain of chains) {
        const at = chain.held.findIndex((held) => held.node === command.node)
        const held = chain.held[at]
        if (held === undefined) continue
        chain.held = chain.held.filter((item) => item.node !== command.node)
        chain.ids = placed(chain.ids, command.node, held.before)
      }
      continue
    }
    if (command.slide !== "element-order") continue
    const chain = take(chains, command.id, command.among)
    if (chain === "stale") continue
    if (chain === null) {
      chains.push({
        slide: command.id,
        ids: moved(command.among, command.node, command.before),
        held: [],
        acceptsAdds: acceptsAdds(command.among, state.index),
      })
      continue
    }
    chain.ids = moved(command.among, command.node, command.before)
  }
  return chains
}

function listed(command: ElementOrder): boolean {
  if (command.among.length === 0 || command.among.length > limits.elements) return false
  if (new Set(command.among).size !== command.among.length) return false
  if (!command.among.includes(command.node)) return false
  if (command.before !== null && !command.among.includes(command.before)) return false
  return command.before !== command.node && command.among.every((id) => shapeOf(id).slide === command.id)
}

export function stackRefusal(state: Indexed, command: ElementOrder): "dead" | "stale" | null {
  if (shapeOf(command.node).slide !== command.id || !listed(command)) return "dead"
  if (command.among.some((id) => elementGone(state, id) || !knownNode(state, id))) return "dead"
  if (take(fold(state), command.id, command.among) === "stale") return "stale"
  return sitsBefore(command.among, command.node) === command.before ? "dead" : null
}

function openingLayers(state: Indexed, slide: SlideId): ElementId[] | undefined {
  if (state.index === undefined || !indexComplete(state)) return undefined
  return state.index.elements
    .filter((element) => !element.grouped && shapeOf(element.node).slide === slide)
    .map((element) => element.node)
}

export function slideLayers(state: Indexed, slide: SlideId): readonly ElementId[] | undefined {
  let ids = openingLayers(state, slide)
  const held: Held[] = []
  for (const command of state.order) {
    if (!("id" in command) || command.id !== slide) continue
    if (groupCommand(command)) ids = undefined
    else if (command.slide === "element-order") {
      if (groupParent(state, command.node) === null) ids = moved(command.among, command.node, command.before)
    } else if (ids === undefined) continue
    else if (command.slide === "element-add" && !command.element.grouped) ids = placed(ids, command.element.node, null)
    else if (command.slide === "element-clone" && ids.includes(command.source)) {
      ids = placed(ids, command.element.node, ids[ids.indexOf(command.source) + 1] ?? null)
    } else if (command.slide === "element-remove" && ids.includes(command.node)) {
      held.push({ node: command.node, before: ids[ids.indexOf(command.node) + 1] ?? null })
      ids = ids.filter((id) => id !== command.node)
    } else if (command.slide === "element-restore") {
      const back = held.find((item) => item.node === command.node)
      if (back !== undefined) ids = placed(ids, back.node, back.before)
    }
  }
  return ids
}

export function elementStacks(state: Indexed): readonly ElementStack[] {
  return fold(state).map((chain) => ({ slide: chain.slide, ids: chain.ids }))
}

export function readElementOrder(raw: Record<string, unknown>, id: SlideId): ElementOrder | undefined {
  const node = readElementId(raw.node)
  if (node === undefined || shapeOf(node).slide !== id) return undefined
  const before = raw.before === null ? null : readElementId(raw.before)
  if (before === undefined || (before !== null && shapeOf(before).slide !== id)) return undefined
  if (!Array.isArray(raw.among) || raw.among.length === 0 || raw.among.length > limits.elements) return undefined
  const among: ElementId[] = []
  for (const item of raw.among) {
    const read = readElementId(item)
    if (read === undefined || shapeOf(read).slide !== id || among.includes(read)) return undefined
    among.push(read)
  }
  return { slide: "element-order", id, node, before, among }
}

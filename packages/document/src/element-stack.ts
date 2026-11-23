import type { DeckIndex } from "./deck-index.js"
import { type ElementId, type SlideId } from "./element-id.js"
import { groupCommand } from "./element-group.js"
import type { SlideState } from "./slide-order.js"

type Indexed = SlideState & { readonly index?: DeckIndex }

type Held = { readonly node: ElementId; readonly before: ElementId | null }

type Chain = {
  slide: SlideId
  ids: ElementId[]
  held: Held[]
  acceptsAdds: boolean
}

export type ElementStack = { readonly slide: SlideId; readonly ids: readonly ElementId[] }

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

export function elementStacks(state: Indexed): readonly ElementStack[] {
  return fold(state).map((chain) => ({ slide: chain.slide, ids: chain.ids }))
}

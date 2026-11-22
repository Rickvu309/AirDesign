import { type OrderKey, orderKeyBetween } from "../order-key.js"
import type { AgentRefusal } from "./agent-change.js"
import type { NodeId } from "./ids.js"
import { type PropName, props } from "./props.js"
import type { Refusal } from "./refusal.js"
import type { Node, Scene, Write } from "./scene.js"
import { type Box, childrenOf, isLive, parentOf } from "./scene-walk.js"
import type { Props } from "./props.js"

export type Values = { readonly [K in PropName]?: Props[K] }
export type Natural = { readonly width: number; readonly height: number }
export type Reading = {
  readonly read?: Scene
  readonly boxes?: ReadonlyMap<NodeId, Box>
  readonly pictures?: ReadonlyMap<string, Natural>
}
export type Draft = {
  readonly scene: Scene
  readonly mint: () => NodeId
  readonly reading: Reading
  readonly writes: Write[]
  readonly tails: Map<NodeId, OrderKey | null>
}

export class Stop extends Error {
  readonly refusal: Omit<AgentRefusal, "change" | "at">
  constructor(refusal: Omit<AgentRefusal, "change" | "at">) {
    super(refusal.refused)
    this.refusal = refusal
  }
}

export function stop(refused: Refusal["refused"], node?: NodeId, field?: string): never {
  throw new Stop({ refused, ...(node === undefined ? {} : { node }), ...(field === undefined ? {} : { field }) })
}

export const draftOf = (scene: Scene, mint: () => NodeId, reading: Reading = {}): Draft => ({
  scene,
  mint,
  reading,
  writes: [],
  tails: new Map(),
})

export function living(draft: Draft, id: NodeId, field?: string): Node {
  const node = draft.scene.nodes.get(id)
  return isLive(node) ? node : stop("missing", id, field)
}

function keyOf(scene: Scene, id: NodeId | undefined): OrderKey | null {
  const node = id === undefined ? undefined : scene.nodes.get(id)
  return (node === undefined ? undefined : (parentOf(node)?.at as OrderKey | undefined)) ?? null
}

function lastKeyIn(draft: Draft, parent: NodeId): OrderKey | null {
  if (draft.tails.has(parent)) return draft.tails.get(parent) ?? null
  const last = childrenOf(draft.scene, parent).at(-1)
  return keyOf(draft.scene, last?.id)
}

export function nextKey(draft: Draft, parent: NodeId): OrderKey {
  const key = orderKeyBetween(lastKeyIn(draft, parent), null)
  draft.tails.set(parent, key)
  return key
}

export function keysAfter(
  draft: Draft,
  parent: NodeId,
  previous: NodeId | null,
  count: number,
  leaving: ReadonlySet<NodeId> = new Set(),
): readonly OrderKey[] {
  const siblings = childrenOf(draft.scene, parent).filter((node) => !leaving.has(node.id))
  const index = previous === null ? -1 : siblings.findIndex((node) => node.id === previous)
  if (previous !== null && index < 0) stop("missing", previous, "after")
  const low = index < 0 ? null : keyOf(draft.scene, siblings[index]?.id)
  const nextKeyed = keyOf(draft.scene, siblings[index + 1]?.id)
  const high = low !== null && nextKeyed !== null && low >= nextKeyed ? null : nextKeyed
  const keys: OrderKey[] = []
  let before = low
  for (let made = 0; made < count; made += 1) {
    before = orderKeyBetween(before, high)
    keys.push(before)
  }
  return keys
}

export function put(draft: Draft, node: NodeId, values: Values, fresh = false): void {
  const seen = draft.reading.read ?? draft.scene
  for (const key of Object.keys(values) as PropName[]) {
    const value = values[key]
    if (value === undefined) continue
    const base = fresh || props[key].conflict !== "base" ? undefined : seen.revs.get(node)?.get(key)
    draft.writes.push({ node, prop: key, value, ...(base === undefined ? {} : { base }) })
  }
}

export function add(
  draft: Draft,
  node: NodeId,
  type: "slideRow" | "slide" | "frame" | "shape",
  parent: NodeId,
  values: Values,
  key: OrderKey = nextKey(draft, parent),
): NodeId {
  draft.writes.push({ node, prop: "type", value: type }, { node, prop: "parent", value: { id: parent, at: key } })
  put(draft, node, values, true)
  return node
}

export const create = (draft: Draft, type: "frame" | "shape", parent: NodeId, values: Values): NodeId =>
  add(draft, draft.mint(), type, parent, values)

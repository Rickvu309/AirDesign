import { sameValue } from "../changing-writes.js"
import type { Doom, Node, Write } from "../doom.js"
import { onDeck, parentOf, propOf } from "../doom-walk.js"
import { type NodeId, readNodeId } from "../ids.js"
import { Reject } from "../read-kit.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { type ComponentRef, type Instance, readInstanceInputs } from "./instance.js"
import { type ComponentSpec, readComponentSpec } from "./spec.js"

export type DeckComponent = { readonly node: NodeId; readonly revision: number; readonly spec: ComponentSpec }

export function deckComponent(fold: Pick<Doom, "nodes">, id: NodeId): DeckComponent | undefined {
  const node = fold.nodes.get(id)
  if (
    node?.type !== "component" ||
    node.spec === undefined ||
    node.revision === undefined ||
    fold.nodes.get(node.parent?.id ?? id)?.type !== "deck"
  )
    return undefined
  const spec = readComponentSpec(node.spec)
  return isRefusal(spec) ? undefined : { node: id, revision: node.revision, spec }
}

export function componentWrites(fold: Pick<Doom, "nodes">, writes: readonly Write[]): Set<NodeId> {
  return new Set(
    writes.flatMap(({ node, prop, value }) =>
      (prop === "type" && value === "component") ||
      (["parent", "spec", "revision"].includes(prop) && fold.nodes.get(node)?.type === "component")
        ? [node]
        : [],
    ),
  )
}

function parentWrites(writes: readonly Write[]): ReadonlyMap<NodeId, NodeId | null> {
  const parents = new Map<NodeId, NodeId | null>()
  for (const { node, prop, value } of writes) {
    if (prop !== "parent") continue
    const id = typeof value === "object" && value !== null ? readNodeId((value as { id?: unknown }).id) : undefined
    parents.set(node, value === null || id === undefined ? null : id)
  }
  return parents
}

function landsOnDeck(fold: Pick<Doom, "nodes">, parents: ReadonlyMap<NodeId, NodeId | null>, id: NodeId): boolean {
  let at: NodeId | null | undefined = id
  for (let hops = 0; at != null && hops <= fold.nodes.size; hops += 1) {
    const node = fold.nodes.get(at)
    if (node?.type === "deck") return true
    at = parents.has(at) ? parents.get(at) : parentOf(node)?.id
  }
  return false
}

function returningInstances(fold: Pick<Doom, "nodes">, writes: readonly Write[]): readonly NodeId[] {
  const parents = parentWrites(writes)
  const returns = [...parents].some(
    ([node, parent]) => parent !== null && fold.nodes.has(node) && !onDeck(fold.nodes, node),
  )
  if (!returns) return []
  const found: NodeId[] = []
  for (const node of fold.nodes.values())
    if (
      propOf(node, "instance")?.component.node !== undefined &&
      !onDeck(fold.nodes, node.id) &&
      landsOnDeck(fold, parents, node.id)
    )
      found.push(node.id)
  return found
}

export function withComponentDeletes(fold: Pick<Doom, "nodes">, writes: readonly Write[]): readonly Write[] {
  const parents = parentWrites(writes)
  const removed = new Set(
    [...parents].flatMap(([node, parent]) =>
      parent === null && fold.nodes.get(node)?.type === "component" ? [node] : [],
    ),
  )
  const returning = returningInstances(fold, writes)
  if (removed.size === 0 && returning.length === 0) return writes
  const explicit = new Set(writes.filter(({ prop }) => prop === "instance").map(({ node }) => node))
  const lives = (component: NodeId) =>
    fold.nodes.get(component)?.type === "component" && landsOnDeck(fold, parents, component)
  const detach: Write[] = []
  for (const node of fold.nodes.values()) {
    const source = propOf(node, "instance")?.component.node
    if (source !== undefined && removed.has(source) && onDeck(fold.nodes, node.id) && !explicit.has(node.id))
      detach.push({ node: node.id, prop: "instance", value: null })
  }
  for (const root of returning) {
    const source = propOf(fold.nodes.get(root), "instance")?.component.node
    if (source !== undefined && !lives(source) && !explicit.has(root))
      detach.push({ node: root, prop: "instance", value: null })
  }
  return detach.length === 0 ? writes : [...writes, ...detach]
}

function nextRevision(prior: Node | undefined, node: Extract<Node, { readonly type: "component" }>): boolean {
  if (prior?.type !== "component" || prior.revision === undefined) return node.revision === 1
  if (sameValue(prior.spec, node.spec)) return node.revision === prior.revision
  return node.revision === prior.revision + 1
}

const liveComponent = (fold: Pick<Doom, "nodes">, id: NodeId) => {
  const node = fold.nodes.get(id)
  return node?.type === "component" && node.parent != null
}

export function guardComponents(
  before: Pick<Doom, "nodes">,
  after: Pick<Doom, "nodes">,
  writes: readonly Write[],
): Refusal | undefined {
  const changed = componentWrites(before, writes)
  if (changed.size === 0) return undefined
  for (const id of changed) {
    const node = after.nodes.get(id)
    if (node?.type !== "component") continue
    if (!nextRevision(before.nodes.get(id), node)) return refuse("shape", id, "revision")
    if (node.parent == null) continue
    if (node.spec === undefined) return refuse("shape", id, "spec")
    if (node.revision === undefined) return refuse("shape", id, "revision")
  }
  let count = 0
  for (const node of after.nodes.values()) if (liveComponent(after, node.id)) count++
  const arrived = [...changed].findLast((id) => liveComponent(after, id) && !liveComponent(before, id))
  if (count > 32 && arrived !== undefined)
    return { ...refuse("limit", arrived, "parent"), form: "A deck holds at most 32 components." }
}

function linkedRoots(
  before: Pick<Doom, "nodes">,
  after: Pick<Doom, "nodes">,
  writes: readonly Write[],
): ReadonlySet<NodeId> {
  const changed = componentWrites(before, writes)
  const affected = new Set([
    ...writes.flatMap(({ node, prop }) => (prop === "instance" ? [node] : [])),
    ...returningInstances(before, writes),
  ])
  if (changed.size > 0)
    for (const node of after.nodes.values()) {
      const source = propOf(node, "instance")?.component.node
      if (source !== undefined && changed.has(source)) affected.add(node.id)
    }
  return affected
}

export function rebuildsLinks(fold: Pick<Doom, "nodes">, writes: readonly Write[]): boolean {
  return (
    componentWrites(fold, writes).size > 0 ||
    returningInstances(fold, writes).length > 0 ||
    writes.some(
      ({ prop, value }) => prop === "instance" && (value as Partial<Instance> | null)?.component?.node !== undefined,
    )
  )
}

export function staleLinks(
  before: Pick<Doom, "nodes">,
  after: Pick<Doom, "nodes">,
  writes: readonly Write[],
): readonly NodeId[] {
  return [...linkedRoots(before, after, writes)].filter((root) => {
    const instance = propOf(after.nodes.get(root), "instance")
    const source = instance?.component.node
    return (
      source !== undefined &&
      onDeck(after.nodes, root) &&
      deckComponent(after, source)?.revision !== instance?.component.revision
    )
  })
}

export function guardDeckLinks(
  before: Pick<Doom, "nodes">,
  after: Pick<Doom, "nodes">,
  writes: readonly Write[],
): Refusal | undefined {
  const resolved = new Map<NodeId, DeckComponent | undefined>()
  for (const root of linkedRoots(before, after, writes)) {
    const instance = propOf(after.nodes.get(root), "instance")
    const source = instance?.component.node
    if (source === undefined || instance === undefined || !onDeck(after.nodes, root)) continue
    if (!resolved.has(source)) resolved.set(source, deckComponent(after, source))
    const component = resolved.get(source)
    if (component === undefined || component.revision !== instance.component.revision)
      return refuse("shape", root, "instance")
    try {
      readInstanceInputs(component.spec, instance)
    } catch (error) {
      if (error instanceof Reject) return refuse(error.kind, root, "instance")
      throw error
    }
  }
}

export const sameComponent = (a: ComponentRef, b: ComponentRef): boolean => a.id === b.id && a.node === b.node

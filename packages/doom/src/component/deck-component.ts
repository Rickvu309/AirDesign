import { sameValue } from "../changing-writes.js"
import type { Doom, Write } from "../doom.js"
import { onDeck, propOf } from "../doom-walk.js"
import type { NodeId } from "../ids.js"
import { Reject } from "../read-kit.js"
import { isRefusal, refuse, type Refusal } from "../refusal.js"
import { type ComponentRef, readInstanceInputs } from "./instance.js"
import { readComponentSpec } from "./spec.js"

export function deckComponent(fold: Pick<Doom, "nodes">, id: NodeId) {
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

export function withComponentDeletes(fold: Pick<Doom, "nodes">, writes: readonly Write[]): readonly Write[] {
  const parents = new Map(writes.filter(({ prop }) => prop === "parent").map(({ node, value }) => [node, value]))
  const removed = new Set(
    [...parents].flatMap(([node, value]) =>
      value === null && fold.nodes.get(node)?.type === "component" ? [node] : [],
    ),
  )
  if (removed.size === 0) return writes
  const explicit = new Set(writes.filter(({ prop }) => prop === "instance").map(({ node }) => node))
  const detach: Write[] = []
  for (const node of fold.nodes.values()) {
    const source = propOf(node, "instance")?.component.node
    if (source !== undefined && removed.has(source) && onDeck(fold.nodes, node.id) && !explicit.has(node.id))
      detach.push({ node: node.id, prop: "instance", value: null })
  }
  return detach.length === 0 ? writes : [...writes, ...detach]
}

export function guardDeckComponents(
  before: Pick<Doom, "nodes">,
  after: Pick<Doom, "nodes">,
  writes: readonly Write[],
  roots: readonly NodeId[],
  preview: boolean,
): Refusal | undefined {
  const changed = componentWrites(before, writes)
  if (changed.size > 0) {
    let count = 0
    for (const node of after.nodes.values()) {
      if (node.type !== "component" || node.parent == null) continue
      count++
      if (count > 32) return { ...refuse("limit", node.id, "parent"), form: "A deck holds at most 32 components." }
      if (!changed.has(node.id)) continue
      if (node.spec === undefined) return refuse("shape", node.id, "spec")
      if (node.revision === undefined) return refuse("shape", node.id, "revision")
      const prior = before.nodes.get(node.id)
      if (prior?.type === "component" && !sameValue(prior.spec, node.spec) && prior.revision === node.revision)
        return refuse("shape", node.id, "revision")
    }
  }
  if (preview) return undefined

  const affected = new Set(roots)
  const returning = writes.some(
    ({ node, prop, value }) =>
      prop === "parent" && value !== null && before.nodes.has(node) && !onDeck(before.nodes, node),
  )
  if (changed.size > 0 || returning) {
    for (const node of after.nodes.values()) {
      const source = propOf(node, "instance")?.component.node
      if (source !== undefined && (changed.has(source) || !onDeck(before.nodes, node.id))) affected.add(node.id)
    }
  }
  const resolved = new Map<NodeId, ReturnType<typeof deckComponent>>()
  for (const root of affected) {
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

import type { Doom, Write } from "../doom.js"
import { onDeck, propOf } from "../doom-walk.js"
import type { NodeId } from "../ids.js"
import type { RunEdit } from "../invert-run.js"
import { props } from "../props.js"
import { isRefusal } from "../refusal.js"
import { componentWrites } from "./deck-component.js"
import type { Instance } from "./instance.js"

export function deletedInstances(
  now: Pick<Doom, "nodes">,
  writes: readonly Write[],
  prior: (root: NodeId) => Instance | undefined,
): { readonly roots: readonly NodeId[]; readonly nodes: ReadonlySet<NodeId> } {
  const roots: NodeId[] = []
  const nodes = new Set<NodeId>()
  if (componentWrites(now, writes).size === 0) return { roots, nodes }
  const removed = new Set(
    writes.flatMap(({ node, prop, value }) => (prop === "parent" && value === null ? [node] : [])),
  )
  for (const root of new Set(writes.flatMap(({ node, prop }) => (prop === "instance" ? [node] : [])))) {
    if (onDeck(now.nodes, root) || removed.has(root)) continue
    roots.push(root)
    nodes.add(root)
    for (const instance of [prior(root), propOf(now.nodes.get(root), "instance")])
      for (const node of [instance?.generated, ...(instance?.parts ?? []).map((part) => part.node)])
        if (node !== undefined) nodes.add(node)
  }
  return { roots, nodes }
}

export function withoutDeletedInstances(
  now: Doom,
  edits: readonly RunEdit[],
): { readonly edits: readonly RunEdit[]; readonly skipped: readonly NodeId[] } {
  const skipped: NodeId[] = []
  const kept = edits.map((edit) => {
    const prior = (root: NodeId) => {
      const cell = edit.replaced.find(({ node, key }) => node === root && key === "instance")
      const instance = cell === undefined ? undefined : props.instance.read(cell.value)
      return instance === undefined || isRefusal(instance) ? undefined : instance
    }
    const deleted = deletedInstances(now, edit.writes, prior)
    if (deleted.roots.length === 0) return edit
    skipped.push(...deleted.roots)
    const stays = ({ node }: { readonly node: NodeId }) => !deleted.nodes.has(node)
    return { ...edit, writes: edit.writes.filter(stays), replaced: edit.replaced.filter(stays) }
  })
  return { edits: kept, skipped }
}

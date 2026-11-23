import type { NodeId, Rev } from "./ids.js"
import type { PropName, WriteKey } from "./props.js"
import type { Landed, Doom, Write } from "./doom.js"
import { type Theme as ThemeValue, type ThemeKey, themeKeys, themeValueAt } from "./theme.js"

function keysOf(edit: Landed): readonly { readonly node: NodeId; readonly key: WriteKey }[] {
  const seen = new Set<string>()
  const keys: { node: NodeId; key: WriteKey }[] = []
  for (const { node, prop } of edit.writes) {
    if (prop === "type") continue
    for (const key of prop === "theme" ? themeKeys : [prop]) {
      if (seen.has(`${node}/${key}`)) continue
      seen.add(`${node}/${key}`)
      keys.push({ node, key })
    }
  }
  return keys
}

const parentIn = (doom: Doom, node: NodeId) =>
  (doom.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent ?? null

function depthIn(doom: Doom, node: NodeId): number {
  if (!doom.nodes.has(node)) return doom.nodes.size
  let depth = 0
  for (let at = parentIn(doom, node); at !== null && depth < doom.nodes.size; at = parentIn(doom, at.id)) depth += 1
  return depth
}

export function invert(before: Doom, after: Doom, edit: Landed, owned: ReadonlySet<Rev> = new Set()): readonly Write[] {
  const writes: Write[] = []
  for (const { node, key } of keysOf(edit)) {
    const writer = after.revs.get(node)?.get(key)
    if (writer === undefined || (writer !== edit.rev && !owned.has(writer))) continue
    const was = before.nodes.get(node)
    if (was === undefined) {
      if (key === "parent") writes.push({ node, prop: key, value: null, base: writer })
      continue
    }
    const value = key.startsWith("theme.")
      ? themeValueAt((was as { theme: ThemeValue }).theme, key as ThemeKey)
      : (was as Record<string, unknown>)[key as PropName]
    writes.push({ node, prop: key, value: value ?? null, base: writer })
  }
  const standing = onStandingLayers(after, writes)
  const moves = standing.filter((each) => each.prop === "parent" && each.value !== null)
  const depths = new Map(moves.map((each) => [each.node, depthIn(before, each.node)]))
  moves.sort((one, other) => depths.get(one.node)! - depths.get(other.node)!)
  return [
    ...moves,
    ...standing.filter((each) => each.prop !== "parent"),
    ...standing.filter((each) => each.prop === "parent" && each.value === null),
  ]
}

const deletedIn = (doom: Doom, node: NodeId) =>
  (doom.nodes.get(node) as { parent?: { readonly id: NodeId } | null } | undefined)?.parent === null

function onStandingLayers(after: Doom, writes: readonly Write[]): readonly Write[] {
  let kept = writes
  for (;;) {
    const placed = new Set(kept.flatMap((each) => (each.prop === "parent" && each.value !== null ? [each.node] : [])))
    const stands = (node: NodeId) => placed.has(node) || !deletedIn(after, node)
    const next = kept.filter((each) =>
      each.prop !== "parent" ? stands(each.node) : each.value === null || stands((each.value as { id: NodeId }).id),
    )
    if (next.length === kept.length) return next
    kept = next
  }
}

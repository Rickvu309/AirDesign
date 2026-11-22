import type { NodeId, Rev } from "./ids.js"
import type { PropName, WriteKey } from "./props.js"
import type { Landed, Scene, Write } from "./scene.js"
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

export function invert(
  before: Scene,
  after: Scene,
  edit: Landed,
  owned: ReadonlySet<Rev> = new Set(),
): readonly Write[] {
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
  return [...writes.filter((each) => each.prop === "parent"), ...writes.filter((each) => each.prop !== "parent")]
}

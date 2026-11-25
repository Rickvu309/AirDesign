import type { Write } from "../doom.js"
import type { NodeId } from "../ids.js"
import { props } from "../props.js"
import { isRefusal } from "../refusal.js"
import type { Instance } from "./instance.js"

type Prior = (node: NodeId, key: "spec" | "instance") => unknown

function linkOf(value: unknown): Instance | undefined {
  if (value == null) return undefined
  const read = props.instance.read(value)
  return isRefusal(read) ? undefined : read
}

export function rebuiltByUpdate(writes: readonly Write[], prior: Prior): (node: NodeId, key: string) => boolean {
  const updated = new Set(
    writes.flatMap(({ node, prop }) => (prop === "spec" && prior(node, "spec") != null ? [node] : [])),
  )
  if (updated.size === 0) return () => false
  const moved = new Set(writes.flatMap(({ node, prop }) => (prop === "parent" ? [node] : [])))
  const roots = new Set<NodeId>()
  const parts = new Set<NodeId>()
  for (const { node, prop, value } of writes) {
    if (prop !== "instance" || moved.has(node)) continue
    const was = linkOf(prior(node, "instance"))
    if (was?.component.node === undefined || !updated.has(was.component.node)) continue
    roots.add(node)
    for (const instance of [was, linkOf(value)])
      for (const part of [instance?.generated, ...(instance?.parts ?? []).map(({ node }) => node)])
        if (part !== undefined) parts.add(part)
  }
  return (node, key) =>
    (key === "revision" && updated.has(node)) || (key === "instance" && roots.has(node)) || parts.has(node)
}

import type { Doom, Write } from "../doom.js"
import type { RunEdit } from "../invert-run.js"
import { onDeck, propOf } from "../doom-walk.js"
import type { NodeId } from "../ids.js"
import { props, type WriteKey } from "../props.js"
import { isRefusal } from "../refusal.js"
import type { Instance } from "./instance.js"

type Prior = (node: NodeId, key: "spec" | "revision" | "instance") => unknown

function linkOf(value: unknown): Instance | undefined {
  if (value == null) return undefined
  const read = props.instance.read(value)
  return isRefusal(read) ? undefined : read
}

const updatesTemplate = ({ prop }: Write) => prop === "spec" || prop === "revision"
const existed = (prior: Prior, node: NodeId) => prior(node, "spec") != null || prior(node, "revision") != null

export function rebuiltByUpdate(writes: readonly Write[], prior: Prior): (node: NodeId, key: string) => boolean {
  const updated = new Set(
    writes.flatMap((write) => (updatesTemplate(write) && existed(prior, write.node) ? [write.node] : [])),
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

function goneTemplates(now: Pick<Doom, "nodes">, writes: readonly Write[], prior: Prior): readonly NodeId[] {
  const moved = new Set(writes.flatMap(({ node, prop }) => (prop === "parent" ? [node] : [])))
  return [
    ...new Set(
      writes.flatMap(({ node, prop }) =>
        prop === "spec" &&
        prior(node, "spec") != null &&
        !moved.has(node) &&
        now.nodes.get(node)?.type === "component" &&
        !onDeck(now.nodes, node)
          ? [node]
          : [],
      ),
    ),
  ]
}

export function skippedTemplates(before: Doom, after: Doom, writes: readonly Write[]): readonly NodeId[] {
  return goneTemplates(after, writes, (node, key) => propOf(before.nodes.get(node), key))
}

export function withoutTemplateUpdate(now: Doom, edit: RunEdit): RunEdit & { readonly skipped: readonly NodeId[] } {
  const prior = (node: NodeId, key: WriteKey) =>
    edit.replaced.find((cell) => cell.node === node && cell.key === key)?.value
  const rebuilt = rebuiltByUpdate(edit.writes, prior)
  const skipped = goneTemplates(now, edit.writes, prior)
  const stays = (node: NodeId, key: WriteKey) => !rebuilt(node, key) && !skipped.includes(node)
  return {
    ...edit,
    writes: edit.writes.filter(({ node, prop }) => stays(node, prop)),
    replaced: edit.replaced.filter(({ node, key }) => stays(node, key)),
    skipped,
  }
}

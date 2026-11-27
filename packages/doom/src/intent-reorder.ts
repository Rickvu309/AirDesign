import type { Direction, Intent } from "./intent-read.js"
import { type Draft, living, stop } from "./intent-draft.js"
import type { NodeId } from "./ids.js"
import type { Doom, Write } from "./doom.js"
import { childrenOf, parentOf } from "./doom-walk.js"
import { type Keyed, siblingKeys } from "./sibling-keys.js"

function reordered(order: readonly NodeId[], chosen: ReadonlySet<NodeId>, direction: Direction): NodeId[] {
  const next = [...order]
  if (direction === "front") return [...next.filter((id) => !chosen.has(id)), ...next.filter((id) => chosen.has(id))]
  if (direction === "back") return [...next.filter((id) => chosen.has(id)), ...next.filter((id) => !chosen.has(id))]
  if (direction === "forward") {
    for (let at = next.length - 2; at >= 0; at -= 1)
      if (chosen.has(next[at]!) && !chosen.has(next[at + 1]!)) [next[at], next[at + 1]] = [next[at + 1]!, next[at]!]
  } else {
    for (let at = 1; at < next.length; at += 1)
      if (chosen.has(next[at]!) && !chosen.has(next[at - 1]!)) [next[at], next[at - 1]] = [next[at - 1]!, next[at]!]
  }
  return next
}

function keyed(view: Doom, ids: readonly NodeId[]): Keyed[] {
  return ids.flatMap((id) => {
    const at = parentOf(view.nodes.get(id))?.at
    return at === undefined ? [] : [{ id, at }]
  })
}

export function reorderWrites(view: Doom, ids: readonly NodeId[], direction: Direction): readonly Write[] {
  const writes: Write[] = []
  const parents = new Set(ids.flatMap((id) => parentOf(view.nodes.get(id))?.id ?? []))
  for (const parent of parents) {
    const order = childrenOf(view, parent).map((child) => child.id)
    const chosen = new Set(ids.filter((id) => order.includes(id)))
    const next = reordered(order, chosen, direction)
    if (next.every((id, at) => id === order[at])) continue
    const siblings = keyed(
      view,
      order.filter((id) => !chosen.has(id)),
    )
    let at = 0
    while (at < next.length) {
      if (!chosen.has(next[at]!)) {
        at += 1
        continue
      }
      let end = at
      while (end < next.length && chosen.has(next[end]!)) end += 1
      const { keys, shifted } = siblingKeys(siblings, at, end - at)
      const placed = next.slice(at, end).map((id, offset) => ({ id, at: keys[offset]! }))
      for (const each of shifted) {
        const index = siblings.findIndex((sibling) => sibling.id === each.id)
        siblings[index] = each
      }
      siblings.splice(at, 0, ...placed)
      at = end
    }
    const original = new Map(keyed(view, order).map((each) => [each.id, each.at]))
    for (const each of siblings) {
      if (chosen.has(each.id) || original.get(each.id) !== each.at)
        writes.push({ node: each.id, prop: "parent", value: { id: parent, at: each.at } })
    }
  }
  return writes
}

export function compileReorder(draft: Draft, intent: Extract<Intent, { op: "reorder" }>): void {
  for (const id of intent.targets) {
    const node = living(draft, id, "targets")
    if (node.type !== "frame" && node.type !== "shape") stop("shape", id, "targets", "form", { code: "layer" })
  }
  draft.writes.push(...reorderWrites(draft.doom, intent.targets, intent.direction))
}

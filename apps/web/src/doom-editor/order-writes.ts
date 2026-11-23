import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { parentSlot, siblingsOf } from "@/editing/node-props"

export type Reorder = "front" | "back" | "forward" | "backward"

function moved(order: readonly doom.NodeId[], chosen: ReadonlySet<doom.NodeId>, how: Reorder): doom.NodeId[] {
  const next = [...order]
  if (how === "front") return [...next.filter((id) => !chosen.has(id)), ...next.filter((id) => chosen.has(id))]
  if (how === "back") return [...next.filter((id) => chosen.has(id)), ...next.filter((id) => !chosen.has(id))]
  if (how === "forward") {
    for (let at = next.length - 2; at >= 0; at -= 1)
      if (chosen.has(next[at]!) && !chosen.has(next[at + 1]!)) [next[at], next[at + 1]] = [next[at + 1]!, next[at]!]
  } else {
    for (let at = 1; at < next.length; at += 1)
      if (chosen.has(next[at]!) && !chosen.has(next[at - 1]!)) [next[at], next[at - 1]] = [next[at - 1]!, next[at]!]
  }
  return next
}

export function orderWrites(view: doom.Doom, ids: readonly doom.NodeId[], how: Reorder): readonly doom.Write[] {
  const writes: doom.Write[] = []
  const parents = new Set(ids.flatMap((id) => parentSlot(view, id)?.id ?? []))
  for (const parent of parents) {
    const order = siblingsOf(view, parent)
    const chosen = new Set(ids.filter((id) => order.includes(id)))
    const next = moved(order, chosen, how)
    if (next.every((id, at) => id === order[at])) continue
    const keys = new Map(order.map((id) => [id, parentSlot(view, id)!.at]))
    let at = 0
    while (at < next.length) {
      if (!chosen.has(next[at]!)) {
        at += 1
        continue
      }
      let end = at
      while (end < next.length && chosen.has(next[end]!)) end += 1
      let low: OrderKey | null = at === 0 ? null : keys.get(next[at - 1]!)!
      const high: OrderKey | null = end === next.length ? null : keys.get(next[end]!)!
      for (let index = at; index < end; index += 1) {
        low = orderKeyBetween(low, high)
        writes.push({ node: next[index]!, prop: "parent", value: { id: parent, at: low } })
      }
      at = end
    }
  }
  return writes
}

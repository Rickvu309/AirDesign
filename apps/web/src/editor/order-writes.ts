import * as doom from "@airdesign/doom"

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

function keyed(view: doom.Doom, ids: readonly doom.NodeId[]): doom.Keyed[] {
  return ids.flatMap((id) => {
    const at = doom.parentOf(view.nodes.get(id))?.at
    return at === undefined ? [] : [{ id, at }]
  })
}

export function orderWrites(view: doom.Doom, ids: readonly doom.NodeId[], how: Reorder): readonly doom.Write[] {
  const writes: doom.Write[] = []
  const parents = new Set(ids.flatMap((id) => doom.parentOf(view.nodes.get(id))?.id ?? []))
  for (const parent of parents) {
    const order = doom.childrenOf(view, parent).map((child) => child.id)
    const chosen = new Set(ids.filter((id) => order.includes(id)))
    const next = moved(order, chosen, how)
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
      const { keys, shifted } = doom.siblingKeys(siblings, at, end - at)
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

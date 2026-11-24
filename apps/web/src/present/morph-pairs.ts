import * as doom from "@airdesign/doom"

export type LayerPairs = readonly (readonly [string, string])[]

function named(view: doom.Doom, id: doom.NodeId): readonly (readonly [string, string])[] {
  return doom.childrenOf(view, id).flatMap((node) => {
    const name = doom.propOf(node, "name")
    return typeof name === "string" && name !== "" ? [[name, node.id] as const] : []
  })
}

export function morphPairs(view: doom.Doom, from: doom.NodeId | undefined, to: doom.NodeId | undefined): LayerPairs {
  if (from === undefined || to === undefined) return []
  const next = new Map<string, string[]>()
  for (const [name, id] of named(view, to)) {
    const held = next.get(name) ?? []
    held.push(id)
    next.set(name, held)
  }
  const used = new Map<string, number>()
  const pairs: [string, string][] = []
  for (const [name, id] of named(view, from)) {
    const at = used.get(name) ?? 0
    used.set(name, at + 1)
    const match = next.get(name)?.[at]
    if (match !== undefined) pairs.push([id, match])
  }
  return pairs
}

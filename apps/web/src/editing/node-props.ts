import * as doom from "@airdesign/doom"

export const propOf = <K extends doom.PropName>(node: doom.Node | undefined, key: K): doom.Props[K] | undefined =>
  (node as Partial<doom.Props> | undefined)?.[key]

export function parentIdOf(view: doom.Doom, id: doom.NodeId): doom.NodeId | null {
  return propOf(view.nodes.get(id), "parent")?.id ?? null
}

export function lockedIn(view: doom.Doom, id: doom.NodeId): boolean {
  for (let at: doom.NodeId | null = id, hops = 0; at !== null && hops <= view.nodes.size; hops += 1) {
    if (propOf(view.nodes.get(at), "locked") === true) return true
    at = parentIdOf(view, at)
  }
  return false
}

export function slidesOf(view: doom.Doom): readonly doom.NodeId[] {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined) return []
  return (view.children.get(deck.id) ?? []).flatMap((row) =>
    propOf(view.nodes.get(row), "hidden") === true ? [] : (view.children.get(row) ?? []),
  )
}

export function flows(view: doom.Doom, id: doom.NodeId): boolean {
  const parent = parentIdOf(view, id)
  const holder = parent === null ? undefined : view.nodes.get(parent)
  if (holder === undefined || holder.type !== "frame") return false
  const layout = propOf(holder, "layout")
  return layout !== undefined && layout.mode !== "none" && propOf(view.nodes.get(id), "absolute") !== true
}

export function geometryKind(view: doom.Doom, id: doom.NodeId): doom.Geometry["kind"] | undefined {
  return propOf(view.nodes.get(id), "geometry")?.kind
}

export function parentSlot(view: doom.Doom, id: doom.NodeId): NonNullable<doom.Props["parent"]> | null {
  return propOf(view.nodes.get(id), "parent") ?? null
}

export function siblingsOf(view: doom.Doom, parent: doom.NodeId): readonly doom.NodeId[] {
  return view.children.get(parent) ?? []
}

export function holdsText(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  const kind = propOf(node, "geometry")?.kind
  return node?.type === "shape" && kind !== "line" && kind !== "icon"
}

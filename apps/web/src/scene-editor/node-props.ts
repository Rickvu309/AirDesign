import type { scene } from "@airdesign/document"

export const propOf = <K extends scene.PropName>(node: scene.Node | undefined, key: K): scene.Props[K] | undefined =>
  (node as Partial<scene.Props> | undefined)?.[key]

export function parentIdOf(view: scene.Scene, id: scene.NodeId): scene.NodeId | null {
  return propOf(view.nodes.get(id), "parent")?.id ?? null
}

export function lockedIn(view: scene.Scene, id: scene.NodeId): boolean {
  for (let at: scene.NodeId | null = id, hops = 0; at !== null && hops <= view.nodes.size; hops += 1) {
    if (propOf(view.nodes.get(at), "locked") === true) return true
    at = parentIdOf(view, at)
  }
  return false
}

export function slideOf(view: scene.Scene, id: scene.NodeId): scene.NodeId | null {
  for (let at: scene.NodeId | null = id, hops = 0; at !== null && hops <= view.nodes.size; hops += 1) {
    if (view.nodes.get(at)?.type === "slide") return at
    at = parentIdOf(view, at)
  }
  return null
}

export function slidesOf(view: scene.Scene): readonly scene.NodeId[] {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined) return []
  return (view.children.get(deck.id) ?? []).flatMap((row) =>
    propOf(view.nodes.get(row), "hidden") === true ? [] : (view.children.get(row) ?? []),
  )
}

export function flows(view: scene.Scene, id: scene.NodeId): boolean {
  const parent = parentIdOf(view, id)
  const holder = parent === null ? undefined : view.nodes.get(parent)
  if (holder === undefined || holder.type !== "frame") return false
  const layout = propOf(holder, "layout")
  return layout !== undefined && layout.mode !== "none" && propOf(view.nodes.get(id), "absolute") !== true
}

export function geometryKind(view: scene.Scene, id: scene.NodeId): scene.Geometry["kind"] | undefined {
  return propOf(view.nodes.get(id), "geometry")?.kind
}

export function parentSlot(view: scene.Scene, id: scene.NodeId): NonNullable<scene.Props["parent"]> | null {
  return propOf(view.nodes.get(id), "parent") ?? null
}

export function siblingsOf(view: scene.Scene, parent: scene.NodeId): readonly scene.NodeId[] {
  return view.children.get(parent) ?? []
}

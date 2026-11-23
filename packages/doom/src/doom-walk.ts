import type { NodeId } from "./ids.js"
import type { PropName, Props } from "./props.js"
import type { Box } from "./resolved.js"
import type { Node, Doom } from "./doom.js"

export type { Box }

export const zeroBox: Box = { x: 0, y: 0, w: 0, h: 0, rotation: 0, flipH: false, flipV: false }

export function propOf<K extends PropName>(node: Node | undefined, key: K): Props[K] | undefined {
  return (node as Partial<Props> | undefined)?.[key]
}

export function get<K extends PropName>(node: Node | undefined, key: K): Props[K] | undefined {
  return propOf(node, key)
}

export const parentOf = (node: Node | undefined): Props["parent"] | undefined => propOf(node, "parent")

export const isLive = (node: Node | undefined): node is Node => node !== undefined && parentOf(node) !== null

export function childrenOf(doom: Doom, id: NodeId): readonly Node[] {
  return (doom.children.get(id) ?? []).flatMap((child) => {
    const node = doom.nodes.get(child)
    return isLive(node) ? [node] : []
  })
}

export function deckOf(doom: Doom): Node | undefined {
  for (const node of doom.nodes.values()) if (node.type === "deck") return node
  return undefined
}

export function rowsOf(doom: Doom, hidden: boolean): readonly Node[] {
  const deck = deckOf(doom)
  if (deck === undefined) return []
  return childrenOf(doom, deck.id).filter((row) => row.type === "slideRow" && (get(row, "hidden") === true) === hidden)
}

export const slidesOf = (doom: Doom): readonly Node[] => rowsOf(doom, false).flatMap((row) => childrenOf(doom, row.id))

export function slideOf(doom: Doom, id: NodeId): NodeId | undefined {
  let at: Node | undefined = doom.nodes.get(id)
  for (let hops = 0; at !== undefined && hops <= doom.nodes.size; hops += 1) {
    if (at.type === "slide") return at.id
    const parent = parentOf(at)
    at = parent == null ? undefined : doom.nodes.get(parent.id)
  }
  return undefined
}

export function descendantsOf(doom: Doom, id: NodeId): readonly Node[] {
  return childrenOf(doom, id).flatMap((child) => [child, ...descendantsOf(doom, child.id)])
}

export function boxOf(node: Node, boxes?: ReadonlyMap<NodeId, Box>): Box {
  return boxes?.get(node.id) ?? get(node, "box") ?? zeroBox
}

export const isLaidOut = (node: Node): boolean => {
  const mode = get(node, "layout")?.mode
  return mode === "row" || mode === "column" || mode === "grid"
}

export function lockedIn(doom: Doom, id: NodeId): boolean {
  for (let at = doom.nodes.get(id), hops = 0; at !== undefined && hops <= doom.nodes.size; hops += 1) {
    if (propOf(at, "locked") === true) return true
    const parent = parentOf(at)
    at = parent == null ? undefined : doom.nodes.get(parent.id)
  }
  return false
}

export function flows(doom: Doom, id: NodeId): boolean {
  const node = doom.nodes.get(id)
  const parent = parentOf(node)
  const holder = parent == null ? undefined : doom.nodes.get(parent.id)
  return holder !== undefined && holder.type === "frame" && isLaidOut(holder) && propOf(node, "absolute") !== true
}

export function holdsText(doom: Doom, id: NodeId): boolean {
  const node = doom.nodes.get(id)
  const kind = propOf(node, "geometry")?.kind
  return node?.type === "shape" && kind !== "line" && kind !== "icon"
}

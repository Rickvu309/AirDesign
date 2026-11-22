import type { NodeId } from "./ids.js"
import type { PropName, Props } from "./props.js"
import type { Node, Scene } from "./scene.js"

export type Box = Props["box"]
export type Placed = { readonly id: NodeId; readonly at: string }

export const zeroBox: Box = { x: 0, y: 0, w: 0, h: 0, rotation: 0, flipH: false, flipV: false }

export const get = <K extends PropName>(node: Node, key: K): Props[K] | undefined => (node as Partial<Props>)[key]

export const parentOf = (node: Node): Placed | null | undefined => get(node, "parent") as Placed | null | undefined

export const isLive = (node: Node | undefined): node is Node => node !== undefined && parentOf(node) !== null

export function childrenOf(scene: Scene, id: NodeId): readonly Node[] {
  return (scene.children.get(id) ?? []).flatMap((child) => {
    const node = scene.nodes.get(child)
    return isLive(node) ? [node] : []
  })
}

export function deckOf(scene: Scene): Node | undefined {
  for (const node of scene.nodes.values()) if (node.type === "deck") return node
  return undefined
}

export function rowsOf(scene: Scene, hidden: boolean): readonly Node[] {
  const deck = deckOf(scene)
  if (deck === undefined) return []
  return childrenOf(scene, deck.id).filter((row) => row.type === "slideRow" && (get(row, "hidden") === true) === hidden)
}

export const slidesOf = (scene: Scene): readonly Node[] =>
  rowsOf(scene, false).flatMap((row) => childrenOf(scene, row.id))

export function slideOf(scene: Scene, id: NodeId): NodeId | undefined {
  let at: Node | undefined = scene.nodes.get(id)
  for (let hops = 0; at !== undefined && hops <= scene.nodes.size; hops += 1) {
    if (at.type === "slide") return at.id
    const parent = parentOf(at)
    at = parent == null ? undefined : scene.nodes.get(parent.id)
  }
  return undefined
}

export function descendantsOf(scene: Scene, id: NodeId): readonly Node[] {
  return childrenOf(scene, id).flatMap((child) => [child, ...descendantsOf(scene, child.id)])
}

export function boxOf(node: Node, boxes?: ReadonlyMap<NodeId, Box>): Box {
  return boxes?.get(node.id) ?? get(node, "box") ?? zeroBox
}

export const isLaidOut = (node: Node): boolean => {
  const mode = get(node, "layout")?.mode
  return mode === "row" || mode === "column" || mode === "grid"
}

import { type OrderKey, orderKeyBetween } from "./order-key.js"
import { applyEdit } from "./apply-edit.js"
import { type NodeId, nodeId, rev } from "./ids.js"
import type { Props } from "./props.js"
import { isRefusal } from "./refusal.js"
import { type Doom, type Write, emptyDoom } from "./doom.js"
import type { Theme } from "./theme.js"

type Settable = Partial<Omit<Props, "type" | "parent" | "theme" | "size" | "name">>
type Ids = Readonly<Record<string, NodeId>>
type Made<T> = T | ((earlier: Ids) => T)

export type TreeNode = {
  readonly type: "frame" | "shape"
  readonly name?: string
  readonly props?: Made<Settable>
  readonly children?: readonly TreeNode[]
}
export type TreeSlide = {
  readonly name?: string
  readonly props?: Made<Pick<Settable, "fills" | "layout" | "hidden" | "notes" | "transition" | "skipped">>
  readonly children: readonly TreeNode[]
}
export type Tree = {
  readonly theme: Theme
  readonly size?: { readonly w: number; readonly h: number }
  readonly slides: readonly TreeSlide[]
}
export type Grown = {
  readonly doom: Doom
  readonly slides: readonly NodeId[]
  readonly ids: Ids
}

export function doomFromTree(tree: Tree): Grown {
  const writes: Write[] = []
  const ids: Record<string, NodeId> = {}
  let counter = 0
  const mint = (name: string | undefined): NodeId => {
    counter += 1
    const id = nodeId(`n:${String(counter)}`)
    if (name !== undefined) ids[name] = id
    return id
  }
  const add = (
    type: string,
    parent: { readonly id: NodeId; readonly at: OrderKey } | null,
    name: string | undefined,
    props: Made<Settable> | undefined,
  ): NodeId => {
    const id = mint(name)
    writes.push({ node: id, prop: "type", value: type })
    if (parent !== null) writes.push({ node: id, prop: "parent", value: parent })
    if (name !== undefined) writes.push({ node: id, prop: "name", value: name })
    const given = typeof props === "function" ? props(ids) : props
    for (const [prop, value] of Object.entries(given ?? {})) writes.push({ node: id, prop: prop as never, value })
    return id
  }
  const grow = (parent: NodeId, nodes: readonly TreeNode[]): void => {
    let after: OrderKey | null = null
    for (const node of nodes) {
      after = orderKeyBetween(after, null)
      const id = add(node.type, { id: parent, at: after }, node.name, node.props)
      grow(id, node.children ?? [])
    }
  }
  const deck = add("deck", null, "deck", undefined)
  writes.push({ node: deck, prop: "theme", value: tree.theme })
  writes.push({ node: deck, prop: "size", value: tree.size ?? { w: 1920, h: 1080 } })
  const row = add("slideRow", { id: deck, at: orderKeyBetween(null, null) }, undefined, undefined)
  const slides: NodeId[] = []
  let after: OrderKey | null = null
  for (const slide of tree.slides) {
    after = orderKeyBetween(after, null)
    const id = add("slide", { id: row, at: after }, slide.name, slide.props)
    slides.push(id)
    grow(id, slide.children)
  }
  const grown = applyEdit(emptyDoom, {
    once: "tree",
    author: { kind: "person", id: "tree" },
    writes,
    rev: rev(1),
  })
  if (isRefusal(grown)) throw new Error(`doom tree refused ${JSON.stringify(grown)}`)
  return { doom: grown, slides, ids }
}

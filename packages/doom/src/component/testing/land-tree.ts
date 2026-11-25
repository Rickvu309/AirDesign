import {
  applyEdit,
  defaultTheme,
  doomFromTree,
  isRefusal,
  orderKeyBetween,
  readEdit,
  rev,
  type Doom,
  type NodeId,
  type Theme,
} from "../../index.js"
import type { ComponentNode, ComponentTree } from "../nodes.js"

export function landTree(tree: ComponentTree, theme: Theme = defaultTheme) {
  const { doom, slides } = doomFromTree({ theme, slides: [{ children: [] }] })
  const writesOf = (node: ComponentTree | ComponentNode, parent: unknown) => [
    { node: node.id, prop: "type", value: node.type },
    { node: node.id, prop: "parent", value: parent },
    ...Object.entries(node.props).map(([prop, value]) => ({ node: node.id, prop, value })),
  ]
  let at = orderKeyBetween(null, null)
  const writes = writesOf(tree, { id: slides[0], at })
  for (const child of tree.children) {
    at = orderKeyBetween(at, null)
    writes.push(...writesOf(child, { id: tree.id, at }))
  }
  const edit = readEdit({ once: "component", author: { kind: "person", id: "fixture" }, writes }, doom)
  if (isRefusal(edit)) throw new Error(JSON.stringify(edit))
  const result = applyEdit(doom, { ...edit, rev: rev(2) })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return { doom: result, slide: slides[0]! }
}

export function writeProps(doom: Doom, writes: readonly { node: NodeId; prop: string; value: unknown }[]): Doom {
  const edit = readEdit({ once: "move", author: { kind: "person", id: "fixture" }, writes }, doom)
  if (isRefusal(edit)) throw new Error(JSON.stringify(edit))
  const result = applyEdit(doom, { ...edit, rev: rev(3) })
  if (isRefusal(result)) throw new Error(JSON.stringify(result))
  return result
}

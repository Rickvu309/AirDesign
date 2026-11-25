import { componentLibrary, defaultTheme, isRefusal, measureWith, type Resolved } from "../../index.js"
import {
  expandComponent,
  type ComponentInput,
  type ComponentNode,
  type ComponentSpec,
  type ComponentTree,
} from "../index.js"

export const measure = measureWith({})
export function librarySpec(id: string): ComponentSpec {
  const found = componentLibrary.get(id)
  if (found === undefined) throw new Error(`Missing template ${id}`)
  return found.spec
}
export const expand = (spec: ComponentSpec, input: Omit<ComponentInput, "theme" | "measure">): ComponentTree => {
  const tree = expandComponent(spec, { theme: defaultTheme, measure, ...input })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  return tree
}
export const role = (tree: ComponentTree, name: string) => tree.children.filter((node) => node.key[0] === name)
export const keyed = (tree: ComponentTree, ...key: string[]) => {
  const found = tree.children.find((node) => node.key.join("/") === key.join("/"))
  if (found === undefined) throw new Error(`No part ${key.join("/")}`)
  return found
}
export const ends = (node: ComponentNode) => {
  const geometry = node.props.geometry
  if (geometry.kind !== "line" || !("node" in geometry.start) || !("node" in geometry.end))
    throw new Error(`${node.key.join("/")} is not an attached line`)
  return { start: geometry.start, end: geometry.end, route: geometry.route }
}
export function resolvedById(doomTree: readonly Resolved[]): ReadonlyMap<string, Resolved> {
  const found = new Map<string, Resolved>()
  const walk = (nodes: readonly Resolved[]) => {
    for (const node of nodes) {
      found.set(node.id, node)
      walk(node.children)
    }
  }
  walk(doomTree)
  return found
}

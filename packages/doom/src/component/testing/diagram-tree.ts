import { componentLibrary } from "../library.js"
import {
  defaultTheme,
  isRefusal,
  measureWith,
  parentOf,
  propOf,
  resolveSlide,
  type Doom,
  type NodeId,
  type Resolved,
} from "../../index.js"
import { writeProps } from "./land-tree.js"
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

export function painted(doom: Doom, slide: NodeId) {
  const spots = new Map<string, { readonly x: number; readonly y: number; readonly text: string | undefined }>()
  const walk = (nodes: readonly Resolved[], x: number, y: number) => {
    for (const node of nodes) {
      const at = { x: x + node.box.x, y: y + node.box.y }
      const text = node.text?.lines.map(({ runs }) => runs.map(({ text }) => text).join("")).join("\n")
      spots.set(node.id, { ...at, text })
      walk(node.children, at.x, at.y)
    }
  }
  walk(resolveSlide(doom, slide, measure), 0, 0)
  return spots
}

export function dragHolder(doom: Doom, frame: string, node: string, by: { readonly x: number; readonly y: number }) {
  let picked = node as NodeId
  while (parentOf(doom.nodes.get(picked))?.id !== frame) picked = parentOf(doom.nodes.get(picked))!.id
  const box = propOf(doom.nodes.get(picked), "box")!
  return writeProps(doom, [{ node: picked, prop: "box", value: { ...box, x: box.x + by.x, y: box.y + by.y } }], 4)
}

export function shifts(before: ReturnType<typeof painted>, after: ReturnType<typeof painted>, ids: readonly string[]) {
  return ids.map((id) => ({ x: after.get(id)!.x - before.get(id)!.x, y: after.get(id)!.y - before.get(id)!.y }))
}

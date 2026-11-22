import type { NodeId } from "./ids.js"
import type { Node, Doom } from "./doom.js"
import { deckOf } from "./doom-walk.js"

const unpainted = new Set(["rev", "parent", "name"])

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, each]) => each !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, each]) => [key, canonical(each)]),
  )
}

function painted(node: Node): unknown {
  return canonical(Object.fromEntries(Object.entries(node).filter(([key]) => !unpainted.has(key))))
}

function gather(doom: Doom, id: NodeId, into: unknown[]): void {
  const node = doom.nodes.get(id)
  if (node === undefined) return
  const children = doom.children.get(id) ?? []
  into.push(painted(node), children)
  for (const child of children) gather(doom, child, into)
}

export function slideKeyText(doom: Doom, slide: NodeId): string {
  const parts: unknown[] = []
  const deck = deckOf(doom)
  if (deck !== undefined) parts.push(painted(deck))
  gather(doom, slide, parts)
  return JSON.stringify(parts)
}

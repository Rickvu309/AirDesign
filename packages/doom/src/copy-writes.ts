import type { Doom, Write } from "./doom.js"
import { keyAbove, propOf } from "./doom-walk.js"
import type { End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import type { PropName, Props } from "./props.js"

type Slot = NonNullable<Props["parent"]>
type Mint = () => NodeId

const skipped = new Set(["id", "rev", "type", "parent", "origin", "slideLayout"])

export type Copies = {
  readonly writes: readonly Write[]
  readonly roots: readonly NodeId[]
  readonly made: ReadonlyMap<NodeId, NodeId>
}

export type Clipboard = { readonly view: Doom; readonly roots: readonly NodeId[] }

const slotOf = (view: Doom, id: NodeId): Slot | null => {
  const node = view.nodes.get(id)
  return node === undefined ? null : (propOf(node, "parent") ?? null)
}

const siblingsOf = (view: Doom, parent: NodeId): readonly NodeId[] => view.children.get(parent) ?? []

function remapped(end: End, map: ReadonlyMap<NodeId, NodeId>): End {
  return "node" in end ? { ...end, node: map.get(end.node) ?? end.node } : end
}

function copyTree(view: Doom, root: NodeId, slot: Slot, mint: Mint, map: Map<NodeId, NodeId>, writes: Write[]): void {
  const node = view.nodes.get(root)
  if (node === undefined) return
  const id = mint()
  map.set(root, id)
  writes.push({ node: id, prop: "type", value: node.type }, { node: id, prop: "parent", value: slot })
  for (const [key, value] of Object.entries(node)) {
    if (!skipped.has(key)) writes.push({ node: id, prop: key as PropName, value })
  }
  for (const child of siblingsOf(view, root)) {
    const at = slotOf(view, child)?.at
    if (at !== undefined) copyTree(view, child, { id, at }, mint, map, writes)
  }
}

function withRemappedLines(writes: readonly Write[], map: ReadonlyMap<NodeId, NodeId>): readonly Write[] {
  return writes.map((write) => {
    const value = write.value as Geometry
    if (write.prop !== "geometry" || value.kind !== "line") return write
    return { ...write, value: { ...value, start: remapped(value.start, map), end: remapped(value.end, map) } }
  })
}

export function copiesOf(
  view: Doom,
  placements: readonly { readonly root: NodeId; readonly slot: Slot }[],
  mint: Mint,
): Copies {
  const map = new Map<NodeId, NodeId>()
  const writes: Write[] = []
  for (const { root, slot } of placements) copyTree(view, root, slot, mint, map, writes)
  return {
    writes: withRemappedLines(writes, map),
    roots: placements.flatMap(({ root }) => map.get(root) ?? []),
    made: map,
  }
}

export function copiedMove(copies: Copies, moves: readonly Write[]): readonly Write[] {
  return [
    ...copies.writes,
    ...moves.flatMap((write) => {
      const copy = copies.made.get(write.node)
      return copy === undefined ? [] : [{ ...write, node: copy }]
    }),
  ]
}

export function duplicateWrites(view: Doom, ids: readonly NodeId[], mint: Mint): Copies {
  const placements = ids.flatMap((root) => {
    const slot = slotOf(view, root)
    if (slot === null) return []
    return [{ root, slot: { id: slot.id, at: orderKeyBetween(slot.at, keyAbove(view, root)) } }]
  })
  return copiesOf(view, placements, mint)
}

export function pasteWrites(clipboard: Clipboard, into: Doom, parent: NodeId, mint: Mint): Copies {
  const siblings = siblingsOf(into, parent)
  const last = siblings[siblings.length - 1]
  let after: OrderKey | null = last === undefined ? null : (slotOf(into, last)?.at ?? null)
  const placements = clipboard.roots.map((root) => {
    after = orderKeyBetween(after, null)
    return { root, slot: { id: parent, at: after } }
  })
  return copiesOf(clipboard.view, placements, mint)
}

import type { Doom, Write } from "./doom.js"
import { propOf } from "./doom-walk.js"
import type { End, Geometry } from "./geometry.js"
import type { NodeId } from "./ids.js"
import { type OrderKey, orderKeyBetween } from "./order-key.js"
import type { PropName, Props } from "./props.js"
import { type Keyed, siblingKeys } from "./sibling-keys.js"

type Slot = NonNullable<Props["parent"]>
type Mint = () => NodeId

const skipped = new Set(["id", "rev", "type", "parent", "origin", "instance"])

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

type Sibling = Keyed & { readonly copyOf?: NodeId }

function retie(
  list: Sibling[],
  index: number,
  shifted: readonly Keyed[],
  slot: Slot,
  moved: Map<NodeId, Slot>,
  copySlots: Map<NodeId, Slot>,
): void {
  let start = -1
  for (let place = 0; place < list.length; place += 1) {
    const covers = place <= index && index < place + shifted.length
    if (!covers || !shifted.every((each, offset) => list[place + offset]?.id === each.id)) continue
    start = place
  }
  if (start < 0) return
  shifted.forEach((shift, offset) => {
    const entry = list[start + offset]!
    list[start + offset] = { ...entry, at: shift.at }
    if (entry.copyOf === undefined) moved.set(entry.id, { id: slot.id, at: shift.at })
    else copySlots.set(entry.copyOf, { id: slot.id, at: shift.at })
  })
}

export function duplicateWrites(view: Doom, ids: readonly NodeId[], mint: Mint): Copies {
  const lists = new Map<NodeId, Sibling[]>()
  const copySlots = new Map<NodeId, Slot>()
  const moved = new Map<NodeId, Slot>()
  for (const root of ids) {
    const slot = slotOf(view, root)
    if (slot === null || copySlots.has(root)) continue
    const list =
      lists.get(slot.id) ??
      siblingsOf(view, slot.id).flatMap((id): Sibling[] => {
        const at = slotOf(view, id)?.at
        return at === undefined ? [] : [{ id, at }]
      })
    lists.set(slot.id, list)
    const index = list.findIndex((each) => each.id === root && each.copyOf === undefined) + 1
    const { keys, shifted } = siblingKeys(list, index, 1)
    retie(list, index, shifted, slot, moved, copySlots)
    list.splice(index, 0, { id: root, at: keys[0]!, copyOf: root })
    copySlots.set(root, { id: slot.id, at: keys[0]! })
  }
  const copies = copiesOf(
    view,
    [...copySlots].map(([root, slot]) => ({ root, slot })),
    mint,
  )
  return {
    ...copies,
    writes: [...copies.writes, ...[...moved].map(([node, value]): Write => ({ node, prop: "parent", value }))],
  }
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

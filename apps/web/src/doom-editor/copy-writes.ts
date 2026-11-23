import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { parentSlot, siblingsOf } from "@/editing/node-props"

type Slot = NonNullable<doom.Props["parent"]>
type Mint = () => doom.NodeId

const skipped = new Set(["id", "rev", "type", "parent", "origin", "slideLayout"])

export type Copies = {
  readonly writes: readonly doom.Write[]
  readonly roots: readonly doom.NodeId[]
  readonly made: ReadonlyMap<doom.NodeId, doom.NodeId>
}

function remapped(end: doom.End, map: ReadonlyMap<doom.NodeId, doom.NodeId>): doom.End {
  return "node" in end ? { ...end, node: map.get(end.node) ?? end.node } : end
}

function copyTree(
  view: doom.Doom,
  root: doom.NodeId,
  slot: Slot,
  mint: Mint,
  map: Map<doom.NodeId, doom.NodeId>,
  writes: doom.Write[],
): void {
  const node = view.nodes.get(root)
  if (node === undefined) return
  const id = mint()
  map.set(root, id)
  writes.push({ node: id, prop: "type", value: node.type }, { node: id, prop: "parent", value: slot })
  for (const [key, value] of Object.entries(node)) {
    if (!skipped.has(key)) writes.push({ node: id, prop: key as doom.PropName, value })
  }
  for (const child of siblingsOf(view, root)) {
    const at = parentSlot(view, child)?.at
    if (at !== undefined) copyTree(view, child, { id, at }, mint, map, writes)
  }
}

function withRemappedLines(writes: readonly doom.Write[], map: ReadonlyMap<doom.NodeId, doom.NodeId>) {
  return writes.map((write) => {
    const value = write.value as doom.Geometry
    if (write.prop !== "geometry" || value.kind !== "line") return write
    return { ...write, value: { ...value, start: remapped(value.start, map), end: remapped(value.end, map) } }
  })
}

export function copiesOf(
  view: doom.Doom,
  placements: readonly { readonly root: doom.NodeId; readonly slot: Slot }[],
  mint: Mint,
): Copies {
  const map = new Map<doom.NodeId, doom.NodeId>()
  const writes: doom.Write[] = []
  for (const { root, slot } of placements) copyTree(view, root, slot, mint, map, writes)
  return {
    writes: withRemappedLines(writes, map),
    roots: placements.flatMap(({ root }) => map.get(root) ?? []),
    made: map,
  }
}

export function copiedMove(copies: Copies, moves: readonly doom.Write[]): readonly doom.Write[] {
  return [
    ...copies.writes,
    ...moves.flatMap((write) => {
      const copy = copies.made.get(write.node)
      return copy === undefined ? [] : [{ ...write, node: copy }]
    }),
  ]
}

export function duplicateWrites(view: doom.Doom, ids: readonly doom.NodeId[], mint: Mint): Copies {
  const placements = ids.flatMap((root) => {
    const slot = parentSlot(view, root)
    if (slot === null) return []
    const siblings = siblingsOf(view, slot.id)
    const next = siblings[siblings.indexOf(root) + 1]
    const above = next === undefined ? null : (parentSlot(view, next)?.at ?? null)
    return [{ root, slot: { id: slot.id, at: orderKeyBetween(slot.at, above) } }]
  })
  return copiesOf(view, placements, mint)
}

export type Clipboard = { readonly view: doom.Doom; readonly roots: readonly doom.NodeId[] }

export function pasteWrites(clipboard: Clipboard, into: doom.Doom, parent: doom.NodeId, mint: Mint): Copies {
  const siblings = siblingsOf(into, parent)
  const last = siblings[siblings.length - 1]
  let after: OrderKey | null = last === undefined ? null : (parentSlot(into, last)?.at ?? null)
  const placements = clipboard.roots.map((root) => {
    after = orderKeyBetween(after, null)
    return { root, slot: { id: parent, at: after } }
  })
  return copiesOf(clipboard.view, placements, mint)
}

import { orderKeyBetween, type OrderKey, type scene } from "@airdesign/document"
import { parentSlot, siblingsOf } from "./node-props"

type Slot = NonNullable<scene.Props["parent"]>
type Mint = () => scene.NodeId

const skipped = new Set(["id", "rev", "type", "parent", "origin", "slideLayout"])

export type Copies = {
  readonly writes: readonly scene.Write[]
  readonly roots: readonly scene.NodeId[]
}

function remapped(end: scene.End, map: ReadonlyMap<scene.NodeId, scene.NodeId>): scene.End {
  return "node" in end ? { ...end, node: map.get(end.node) ?? end.node } : end
}

function copyTree(
  view: scene.Scene,
  root: scene.NodeId,
  slot: Slot,
  mint: Mint,
  map: Map<scene.NodeId, scene.NodeId>,
  writes: scene.Write[],
): void {
  const node = view.nodes.get(root)
  if (node === undefined) return
  const id = mint()
  map.set(root, id)
  writes.push({ node: id, prop: "type", value: node.type }, { node: id, prop: "parent", value: slot })
  for (const [key, value] of Object.entries(node)) {
    if (!skipped.has(key)) writes.push({ node: id, prop: key as scene.PropName, value })
  }
  for (const child of siblingsOf(view, root)) {
    const at = parentSlot(view, child)?.at
    if (at !== undefined) copyTree(view, child, { id, at }, mint, map, writes)
  }
}

function withRemappedLines(writes: readonly scene.Write[], map: ReadonlyMap<scene.NodeId, scene.NodeId>) {
  return writes.map((write) => {
    const value = write.value as scene.Geometry
    if (write.prop !== "geometry" || value.kind !== "line") return write
    return { ...write, value: { ...value, start: remapped(value.start, map), end: remapped(value.end, map) } }
  })
}

export function copiesOf(
  view: scene.Scene,
  placements: readonly { readonly root: scene.NodeId; readonly slot: Slot }[],
  mint: Mint,
): Copies {
  const map = new Map<scene.NodeId, scene.NodeId>()
  const writes: scene.Write[] = []
  for (const { root, slot } of placements) copyTree(view, root, slot, mint, map, writes)
  return {
    writes: withRemappedLines(writes, map),
    roots: placements.flatMap(({ root }) => map.get(root) ?? []),
  }
}

export function duplicateWrites(view: scene.Scene, ids: readonly scene.NodeId[], mint: Mint): Copies {
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

export type Clipboard = { readonly view: scene.Scene; readonly roots: readonly scene.NodeId[] }

export function pasteWrites(clipboard: Clipboard, into: scene.Scene, parent: scene.NodeId, mint: Mint): Copies {
  const siblings = siblingsOf(into, parent)
  const last = siblings[siblings.length - 1]
  let after: OrderKey | null = last === undefined ? null : (parentSlot(into, last)?.at ?? null)
  const placements = clipboard.roots.map((root) => {
    after = orderKeyBetween(after, null)
    return { root, slot: { id: parent, at: after } }
  })
  return copiesOf(clipboard.view, placements, mint)
}

import { orderKeyBetween, type OrderKey } from "@airdesign/doom"
import * as doom from "@airdesign/doom"
import { apply, invert, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

type Made = { readonly writes: readonly doom.Write[]; readonly selected: readonly doom.NodeId[] }

function localBounds(parent: Placed | undefined, members: readonly Placed[]) {
  const toLocal = (point: Point) => (parent === undefined ? point : apply(invert(parent.matrix), point))
  const points = members.flatMap((each) => each.corners.map(toLocal))
  const left = Math.min(...points.map((point) => point.x))
  const top = Math.min(...points.map((point) => point.y))
  return {
    x: Math.round(left),
    y: Math.round(top),
    w: Math.max(1, Math.round(Math.max(...points.map((point) => point.x)) - left)),
    h: Math.max(1, Math.round(Math.max(...points.map((point) => point.y)) - top)),
  }
}

function sharedParent(view: doom.Doom, ids: readonly doom.NodeId[]): doom.NodeId | null {
  const parents = new Set(ids.map((id) => doom.parentOf(view.nodes.get(id))?.id ?? null))
  const [only] = [...parents]
  return parents.size === 1 && only !== undefined ? only : null
}

export function wrapWrites(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  kind: "group" | "frame",
  mint: () => doom.NodeId,
): Made | null {
  const parent = sharedParent(view, ids)
  if (parent === null || ids.length === 0) return null
  const siblings = doom.childrenOf(view, parent)
  const ordered = siblings.filter((node) => ids.includes(node.id))
  const members = ordered.flatMap((node) => geometry.byId.get(node.id) ?? [])
  if (members.length !== ordered.length) return null
  const holder = geometry.byId.get(parent)
  const front = ordered[ordered.length - 1]!
  const frontAt = doom.parentOf(front)!.at
  const origin = localBounds(holder, members)
  const wrapper = mint()
  const writes: doom.Write[] = [
    { node: wrapper, prop: "type", value: "frame" },
    { node: wrapper, prop: "parent", value: { id: parent, at: frontAt } },
    { node: wrapper, prop: "name", value: kind === "group" ? "Group" : "Frame" },
    { node: wrapper, prop: "box", value: { ...origin, rotation: 0, flipH: false, flipV: false } },
    ...(kind === "group"
      ? [{ node: wrapper, prop: "sizing" as const, value: { w: "hug", h: "hug" } }]
      : [{ node: wrapper, prop: "clip" as const, value: true }]),
  ]
  let after: OrderKey | null = null
  for (const member of members) {
    after = orderKeyBetween(after, null)
    const stored = doom.propOf(view.nodes.get(member.id), "box") ?? member.node.box
    const line = doom.propOf(view.nodes.get(member.id), "geometry")
    writes.push({ node: member.id, prop: "parent", value: { id: wrapper, at: after } })
    if (line?.kind === "line") {
      const shift = (end: doom.End): doom.End => ("node" in end ? end : { x: end.x - origin.x, y: end.y - origin.y })
      writes.push({
        node: member.id,
        prop: "geometry",
        value: { ...line, start: shift(line.start), end: shift(line.end) },
      })
    } else {
      const spot = member.node.box
      writes.push({
        node: member.id,
        prop: "box",
        value: { ...stored, x: Math.round(spot.x - origin.x), y: Math.round(spot.y - origin.y) },
      })
    }
  }
  return { writes, selected: [wrapper] }
}

export function ungroupWrites(view: doom.Doom, geometry: SlideGeometry, ids: readonly doom.NodeId[]): Made | null {
  const writes: doom.Write[] = []
  const selected: doom.NodeId[] = []
  for (const id of ids) {
    const node = view.nodes.get(id)
    const slot = doom.parentOf(node) ?? null
    const frame = geometry.byId.get(id)
    if (node?.type !== "frame" || slot === null || frame === undefined) continue
    const holder = geometry.byId.get(slot.id)
    const toHolder = (point: Point) => (holder === undefined ? point : apply(invert(holder.matrix), point))
    const siblings = doom.childrenOf(view, slot.id)
    const nextAt = doom.parentOf(siblings[siblings.findIndex((each) => each.id === id) + 1])?.at ?? null
    let after: OrderKey | null = slot.at
    for (const child of doom.childrenOf(view, id)) {
      const placed = geometry.byId.get(child.id)
      const stored = doom.propOf(child, "box")
      if (placed === undefined) continue
      after = orderKeyBetween(after, nextAt)
      writes.push({ node: child.id, prop: "parent", value: { id: slot.id, at: after } })
      selected.push(child.id)
      const line = doom.propOf(child, "geometry")
      if (line?.kind === "line") {
        const move = (end: doom.End): doom.End => {
          if ("node" in end) return end
          const spot = toHolder(apply(frame.matrix, end))
          return { x: Math.round(spot.x), y: Math.round(spot.y) }
        }
        writes.push({
          node: child.id,
          prop: "geometry",
          value: { ...line, start: move(line.start), end: move(line.end) },
        })
        continue
      }
      const { w, h } = placed.node.box
      const centre = toHolder(apply(placed.matrix, { x: placed.node.box.w / 2, y: placed.node.box.h / 2 }))
      writes.push({
        node: child.id,
        prop: "box",
        value: {
          ...(stored ?? placed.node.box),
          x: Math.round(centre.x - w / 2),
          y: Math.round(centre.y - h / 2),
          rotation: doom.wrapRotation(placed.rotation - (holder?.rotation ?? 0)),
        },
      })
    }
    writes.push({ node: id, prop: "parent", value: null })
  }
  return writes.length === 0 ? null : { writes, selected }
}

import * as doom from "@airdesign/doom"
import { reachOf, snapMove, type Bounds, type Guide, type SnapTargets } from "@airdesign/render"
import { flows, lockedIn, propOf } from "./node-props"
import { aroundPlaced, invert, linear, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

const zero: Point = { x: 0, y: 0 }

export function movable(view: doom.Doom, id: doom.NodeId): boolean {
  const node = view.nodes.get(id)
  if (node === undefined || (node.type !== "frame" && node.type !== "shape")) return false
  if (lockedIn(view, id) || flows(view, id)) return false
  const geometry = propOf(node, "geometry")
  if (geometry?.kind !== "line") return true
  return !("node" in geometry.start && "node" in geometry.end)
}

function parentSpace(geometry: SlideGeometry, placed: Placed, by: Point): Point {
  const parent = placed.parent === null ? undefined : geometry.byId.get(placed.parent)
  return parent === undefined ? by : linear(invert(parent.matrix), by)
}

function shiftedEnd(end: doom.End, by: Point): doom.End {
  return "node" in end ? end : { x: Math.round(end.x + by.x), y: Math.round(end.y + by.y) }
}

export function moveWrites(
  view: doom.Doom,
  geometry: SlideGeometry,
  ids: readonly doom.NodeId[],
  by: Point,
): readonly doom.Write[] {
  return ids.flatMap((id): doom.Write[] => {
    const placed = geometry.byId.get(id)
    const node = view.nodes.get(id)
    if (placed === undefined || node === undefined || !movable(view, id)) return []
    const local = parentSpace(geometry, placed, by)
    const line = propOf(node, "geometry")
    if (line?.kind === "line")
      return [
        {
          node: id,
          prop: "geometry",
          value: { ...line, start: shiftedEnd(line.start, local), end: shiftedEnd(line.end, local) },
        },
      ]
    const stored = propOf(node, "box") ?? placed.node.box
    const next = { ...stored, x: Math.round(stored.x + local.x), y: Math.round(stored.y + local.y) }
    return next.x === stored.x && next.y === stored.y ? [] : [{ node: id, prop: "box", value: next }]
  })
}

export type MoveInput = {
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly ids: readonly doom.NodeId[]
  readonly by: Point
  readonly snap: boolean
  readonly lockAxis: boolean
  readonly scale: number
  readonly size: { readonly w: number; readonly h: number }
}

export type Moved = {
  readonly by: Point
  readonly guides: readonly Guide[]
  readonly writes: readonly doom.Write[]
}

function targetsFor(input: MoveInput, movers: readonly Placed[]): SnapTargets {
  const first = movers[0]!
  const holder = first.parent === null ? undefined : input.geometry.byId.get(first.parent)
  const siblings = holder === undefined ? input.geometry.roots : holder.children
  const moving = new Set(movers.map((each) => each.id))
  return {
    layers: siblings.filter((each) => !moving.has(each.id)).map((each) => each.bounds),
    slide: holder === undefined ? { left: 0, top: 0, right: input.size.w, bottom: input.size.h } : holder.bounds,
  }
}

function shifted(bounds: Bounds, by: Point): Bounds {
  return { left: bounds.left + by.x, top: bounds.top + by.y, right: bounds.right + by.x, bottom: bounds.bottom + by.y }
}

export function movedBy(input: MoveInput): Moved {
  const movers = input.ids.filter((id) => movable(input.view, id)).flatMap((id) => input.geometry.byId.get(id) ?? [])
  const start = aroundPlaced(movers)
  if (start === null) return { by: zero, guides: [], writes: [] }
  const free = input.lockAxis
    ? Math.abs(input.by.x) >= Math.abs(input.by.y)
      ? { x: input.by.x, y: 0 }
      : { x: 0, y: input.by.y }
    : input.by
  if (!input.snap) {
    const by = { x: Math.round(free.x), y: Math.round(free.y) }
    return { by, guides: [], writes: moveWrites(input.view, input.geometry, input.ids, by) }
  }
  const snapped = snapMove(
    shifted(start, free),
    targetsFor(input, movers),
    reachOf(input.size.w * input.scale, input.size.w),
  )
  const by = { x: Math.round(snapped.box.left - start.left), y: Math.round(snapped.box.top - start.top) }
  return { by, guides: snapped.guides, writes: moveWrites(input.view, input.geometry, input.ids, by) }
}

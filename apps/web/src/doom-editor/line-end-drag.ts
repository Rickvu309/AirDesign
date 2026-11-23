import * as doom from "@airdesign/doom"
import { propOf } from "@airdesign/doom"
import { apply, invert, type Placed, type Point, type SlideGeometry } from "./slide-geometry"

export type EndGrip = "line-start" | "line-end"
export type Aim = { readonly sites: readonly Point[]; readonly site: Point | null }

type Line = Extract<doom.Geometry, { kind: "line" }>

const sites: readonly doom.Site[] = ["t", "r", "b", "l", "c"]
const siteReach = 12
const step = Math.PI / 4

export const isEndGrip = (grip: string): grip is EndGrip => grip === "line-start" || grip === "line-end"

export function lineEnds(placed: Placed): readonly [Point, Point] | null {
  const geometry = placed.node.geometry
  if (geometry?.kind !== "line") return null
  return [apply(placed.matrix, geometry.from), apply(placed.matrix, geometry.to)]
}

function siteSpots(view: doom.Doom, placed: Placed): readonly { readonly site: doom.Site; readonly at: Point }[] {
  const { w, h } = placed.node.box
  const geometry = propOf(view.nodes.get(placed.id), "geometry")
  return sites.map((site) => ({ site, at: apply(placed.matrix, doom.siteSpot(geometry, w, h, site)) }))
}

function holders(view: doom.Doom, geometry: SlideGeometry, line: doom.NodeId): readonly Placed[] {
  return [...geometry.byId.values()].filter((placed) => doom.holdsLineEnd(view, placed.id, line))
}

function inside(placed: Placed, at: Point): boolean {
  const local = apply(invert(placed.matrix), at)
  return local.x >= 0 && local.y >= 0 && local.x <= placed.node.box.w && local.y <= placed.node.box.h
}

function angled(from: Point, at: Point): Point {
  const dx = at.x - from.x
  const dy = at.y - from.y
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  const along = dx * Math.cos(angle) + dy * Math.sin(angle)
  return { x: from.x + Math.cos(angle) * along, y: from.y + Math.sin(angle) * along }
}

export function lineEndDrag(args: {
  readonly view: doom.Doom
  readonly geometry: SlideGeometry
  readonly line: doom.NodeId
  readonly grip: EndGrip
  readonly at: Point
  readonly snap: boolean
  readonly lockAngle: boolean
  readonly scale: number
}): { readonly writes: readonly doom.Write[]; readonly aim: Aim | null } {
  const { view, geometry, line, grip, snap, lockAngle, scale } = args
  const placed = geometry.byId.get(line)
  const stored = propOf(view.nodes.get(line), "geometry")
  const ends = placed === undefined ? null : lineEnds(placed)
  if (placed === undefined || ends === null || stored?.kind !== "line") return { writes: [], aim: null }
  const key = grip === "line-start" ? "start" : "end"
  const other = grip === "line-start" ? ends[1] : ends[0]
  const at = lockAngle ? angled(other, args.at) : args.at
  const write = (end: doom.End): readonly doom.Write[] => [
    { node: line, prop: "geometry", value: { ...stored, [key]: end } satisfies Line },
  ]
  const free = (): doom.End => {
    const local = apply(invert(placed.matrix), at)
    return { x: Math.round(placed.node.box.x + local.x), y: Math.round(placed.node.box.y + local.y) }
  }
  if (!snap || lockAngle) return { writes: write(free()), aim: null }
  const reach = siteReach / scale
  const near = holders(view, geometry, line)
    .flatMap((holder) => siteSpots(view, holder).map((spot) => ({ holder, ...spot })))
    .map((spot) => ({ ...spot, far: Math.hypot(spot.at.x - at.x, spot.at.y - at.y) }))
    .filter((spot) => spot.far <= reach)
    .sort((one, two) => one.far - two.far)[0]
  if (near !== undefined) {
    const aim = { sites: siteSpots(view, near.holder).map((spot) => spot.at), site: near.at }
    return { writes: write({ node: near.holder.id, site: near.site }), aim }
  }
  const over = holders(view, geometry, line).findLast((holder) => inside(holder, at))
  const aim = over === undefined ? null : { sites: siteSpots(view, over).map((spot) => spot.at), site: null }
  return { writes: write(free()), aim }
}

export function attachedEnds(view: doom.Doom, id: doom.NodeId | undefined): readonly [boolean, boolean] {
  const geometry = id === undefined ? undefined : propOf(view.nodes.get(id), "geometry")
  if (geometry?.kind !== "line") return [false, false]
  return ["node" in geometry.start, "node" in geometry.end]
}

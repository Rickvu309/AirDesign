import type { Box } from "./box.js"
import { landedPatch, type Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import {
  frameBackdrop,
  groupBounds,
  groupChildren,
  groupFrame,
  groupParent,
  groupRejoined,
  madeGroup,
  rejoinedGroups,
  type Member,
} from "./element-group.js"
import { elementGone } from "./element-order.js"
import { takes } from "./element-takes.js"
import {
  boxEdits,
  heldSides,
  memberOf,
  openingPlace,
  placeOf,
  throughGroup,
  type Place,
  type PlacedRow,
} from "./group-place.js"
import { openingElement } from "./slide-floor.js"

export function fittedPlace(place: Place, frame: Box, fitted: Box): Place {
  return throughGroup({ box: fitted, rot: 0, flipH: false, flipV: false }, place, frame)
}

export type Rebased = { readonly place: Place; readonly frame: Box }

type Space = { readonly place: Place; readonly frame: Box }

const fullTurn = 21_600_000
const turnsPerDegree = 60_000

function turned(turn: number): number {
  return ((turn % fullTurn) + fullTurn) % fullTurn
}

function scaleOf(side: number, frame: number): number {
  return frame === 0 ? 1 : side / frame
}

function spin(x: number, y: number, rot: number): readonly [number, number] {
  const radians = (rot / turnsPerDegree) * (Math.PI / 180)
  return [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)]
}

export function intoGroup(shown: Place, group: Place, frame: Box): Place {
  const scaleX = scaleOf(group.box.cx, frame.cx)
  const scaleY = scaleOf(group.box.cy, frame.cy)
  const middleX = group.box.x + group.box.cx / 2
  const middleY = group.box.y + group.box.cy / 2
  const [awayX, awayY] = spin(
    shown.box.x + shown.box.cx / 2 - middleX,
    shown.box.y + shown.box.cy / 2 - middleY,
    -group.rot,
  )
  const scaledX = middleX + (group.flipH ? -awayX : awayX)
  const scaledY = middleY + (group.flipV ? -awayY : awayY)
  const centreX = frame.x + (scaledX - group.box.x) / scaleX
  const centreY = frame.y + (scaledY - group.box.y) / scaleY
  const cx = Math.round(shown.box.cx / scaleX)
  const cy = Math.round(shown.box.cy / scaleY)
  const turn = shown.rot - group.rot
  return {
    box: { x: Math.round(centreX - cx / 2) + 0, y: Math.round(centreY - cy / 2) + 0, cx, cy },
    rot: turned(group.flipH !== group.flipV ? -turn : turn),
    flipH: shown.flipH !== group.flipH,
    flipV: shown.flipV !== group.flipV,
  }
}

function frameAbove(register: Register, node: ElementId): boolean {
  const parent = groupParent(register, node)
  return typeof parent === "string" && frameBackdrop(register, parent) !== null
}

function spaceOf(register: Register, group: ElementId): Space | null {
  if (frameBackdrop(register, group) !== null || frameAbove(register, group)) return null
  const frame = groupFrame(register, group)
  const place = placeOf(register, group)
  if (frame === null || place === null) return null
  if ((place.box.cx === 0 && frame.cx !== 0) || (place.box.cy === 0 && frame.cy !== 0)) return null
  return { place, frame }
}

function boxMoved(register: Register, node: ElementId): boolean {
  if (!register.nodes.includes(node)) return false
  const body = register.elements[node]
  const edits = body === undefined ? {} : (landedPatch(body, "text").box ?? {})
  return Object.values(edits).some((edit) => typeof edit === "object")
}

function fittedFrame(members: readonly Member[], space: Space): Box {
  return groupBounds(members, scaleOf(space.place.box.cx, space.frame.cx), scaleOf(space.place.box.cy, space.frame.cy))
}

const rebases = new WeakMap<Register, Map<ElementId, Rebased | null>>()

export function rebased(register: Register, group: ElementId): Rebased | null {
  const known = rebases.get(register) ?? new Map<ElementId, Rebased | null>()
  rebases.set(register, known)
  if (known.has(group)) return known.get(group) ?? null
  known.set(group, null)
  const found = rebasedNow(register, group)
  known.set(group, found)
  return found
}

function rebasedNow(register: Register, group: ElementId): Rebased | null {
  const space = spaceOf(register, group)
  if (space === null || elementGone(register, group)) return null
  const all = groupChildren(register, group)
  const children = all.filter((child) => !elementGone(register, child))
  const changed = children.length < all.length || groupRejoined(register, group)
  if (!changed && !children.some((child) => boxMoved(register, child) || rebased(register, child) !== null)) return null
  const members = children.flatMap((child) => {
    const place = rebased(register, child)?.place ?? placeOf(register, child)
    return place === null ? [] : [memberOf(child, place)]
  })
  if (members.length !== children.length || members.length === 0) return null
  const frame = fittedFrame(members, space)
  return { frame, place: fittedPlace(space.place, space.frame, frame) }
}

function chainOf(register: Register, node: ElementId): readonly Space[] | null {
  const chain: Space[] = []
  for (let parent = groupParent(register, node); parent !== null; parent = groupParent(register, parent)) {
    if (parent === undefined || chain.length > 64) return null
    const space = spaceOf(register, parent)
    if (space === null) return null
    chain.push(space)
  }
  return chain
}

export function followsGroups(register: Register, node: ElementId): boolean {
  const parent = groupParent(register, node)
  if (typeof parent === "string") return frameBackdrop(register, parent) === null
  return rebased(register, node) !== null
}

export function shownPlace(register: Register, node: ElementId): Place | null {
  const chain = chainOf(register, node)
  let place = rebased(register, node)?.place ?? placeOf(register, node)
  if (chain === null || place === null) return null
  for (const space of chain) place = throughGroup(place, space.place, space.frame)
  return place
}

function unrebased(shown: Place, own: Rebased, space: Space): Place {
  const { frame, place } = space
  const scaleX = own.frame.cx === 0 ? scaleOf(place.box.cx, frame.cx) : shown.box.cx / own.frame.cx
  const scaleY = own.frame.cy === 0 ? scaleOf(place.box.cy, frame.cy) : shown.box.cy / own.frame.cy
  const cx = frame.cx === 0 ? place.box.cx : Math.round(frame.cx * scaleX)
  const cy = frame.cy === 0 ? place.box.cy : Math.round(frame.cy * scaleY)
  const awayX = (own.frame.x + own.frame.cx / 2 - frame.x) * scaleOf(cx, frame.cx) - cx / 2
  const awayY = (own.frame.y + own.frame.cy / 2 - frame.y) * scaleOf(cy, frame.cy) - cy / 2
  const [spunX, spunY] = spin(shown.flipH ? -awayX : awayX, shown.flipV ? -awayY : awayY, shown.rot)
  const middleX = shown.box.x + shown.box.cx / 2 - spunX
  const middleY = shown.box.y + shown.box.cy / 2 - spunY
  return {
    box: { x: Math.round(middleX - cx / 2) + 0, y: Math.round(middleY - cy / 2) + 0, cx, cy },
    rot: shown.rot,
    flipH: shown.flipH,
    flipV: shown.flipV,
  }
}

function spacesFrom(register: Register, parent: ElementId | null | undefined): readonly Space[] | null {
  if (parent === undefined) return null
  if (parent === null) return []
  const own = spaceOf(register, parent)
  const above = chainOf(register, parent)
  return own === null || above === null ? null : [own, ...above]
}

export function slideAligned(register: Register, group: ElementId): boolean {
  const spaces = spacesFrom(register, group)
  const same = (left: Box, right: Box) =>
    (["x", "y", "cx", "cy"] as const).every((side) => Math.abs(left[side] - right[side]) <= 1)
  return (
    spaces !== null &&
    spaces.every(({ place, frame }) => place.rot === 0 && !place.flipH && !place.flipV && same(place.box, frame))
  )
}

export function storedPlace(register: Register, node: ElementId, shown: Place): Place | null {
  return storedPlaceIn(register, node, groupParent(register, node), shown)
}

export function storedPlaceIn(
  register: Register,
  node: ElementId,
  parent: ElementId | null | undefined,
  shown: Place,
): Place | null {
  const chain = spacesFrom(register, parent)
  if (chain === null) return null
  let place = shown
  for (const space of chain.toReversed()) place = intoGroup(place, space.place, space.frame)
  const own = rebased(register, node)
  const space = own === null ? null : spaceOf(register, node)
  return own === null || space === null ? place : unrebased(place, own, space)
}

function near(left: Place, right: Place): boolean {
  const sides = (["x", "y", "cx", "cy"] as const).every((side) => Math.abs(left.box[side] - right.box[side]) <= 1)
  return sides && left.rot === right.rot && left.flipH === right.flipH && left.flipV === right.flipV
}

export function regroupedRows(before: Register, formed: Register, group: ElementId): readonly PlacedRow[] {
  const space = spaceOf(formed, group)
  if (space === null) return []
  return groupChildren(formed, group).flatMap((node): PlacedRow[] => {
    const held = heldSides(formed, node)
    const place = placeOf(before, node)
    const opening = openingElement(formed, node)
    const own = placeOf(formed, node)
    if (held.size === 0 || place === null || opening === undefined || own === null) return []
    const mapped = intoGroup(place, space.place, space.frame)
    const home = madeGroup(formed, group) === undefined ? openingPlace(opening) : null
    if (home !== null && near(mapped, home))
      return [{ node, patch: { box: Object.fromEntries([...held].map((side) => [side, "opening" as const])) } }]
    const facts = { kind: opening.kind, text: opening.value !== null, grouped: true, animated: false }
    const patch = boxEdits(own, mapped, held, takes(facts))
    return patch.box === undefined ? [] : [{ node, patch }]
  })
}

export type RebasedGroup = Rebased & { readonly node: ElementId }

export function rebasedGroups(register: Register): readonly RebasedGroup[] {
  const seen = new Set<ElementId>()
  const found: RebasedGroup[] = []
  const starts = [...register.nodes.map((node) => groupParent(register, node)), ...rejoinedGroups(register)]
  for (const start of starts) {
    for (let parent = start; typeof parent === "string"; parent = groupParent(register, parent)) {
      if (seen.has(parent)) break
      seen.add(parent)
      const own = rebased(register, parent)
      if (own !== null) found.push({ node: parent, ...own })
    }
  }
  return found
}

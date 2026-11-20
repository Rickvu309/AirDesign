import type { Box } from "./box.js"
import { currentBox, landedPatch, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { shapeOf, type ElementId, type SlideId } from "./element-id.js"
import {
  frameBackdrop,
  frameMembers,
  frameSource,
  groupBounds,
  groupChildren,
  groupFrame,
  groupParent,
  joinedMember,
  madeGroup,
  type ElementGroup,
  type Member,
} from "./element-group.js"
import { takes, type ElementFacts } from "./element-takes.js"
import { frameNow, huggedSize, readLayout } from "./frame-layout.js"
import type { ElementPatch, FieldEdit } from "./row.js"
import { openingElement } from "./slide-floor.js"
import type { FieldKey } from "./traits.js"

export type Place = { readonly box: Box; readonly rot: number; readonly flipH: boolean; readonly flipV: boolean }

export type PlacedRow = { readonly node: ElementId; readonly patch: ElementPatch }

const fullTurn = 21_600_000
const turnsPerDegree = 60_000

export function throughGroup(child: Place, group: Place, frame: Box): Place {
  const scaleX = frame.cx === 0 ? 1 : group.box.cx / frame.cx
  const scaleY = frame.cy === 0 ? 1 : group.box.cy / frame.cy
  const scaledX = group.box.x + (child.box.x + child.box.cx / 2 - frame.x) * scaleX
  const scaledY = group.box.y + (child.box.y + child.box.cy / 2 - frame.y) * scaleY
  const middleX = group.box.x + group.box.cx / 2
  const middleY = group.box.y + group.box.cy / 2
  const fromX = (group.flipH ? 2 * middleX - scaledX : scaledX) - middleX
  const fromY = (group.flipV ? 2 * middleY - scaledY : scaledY) - middleY
  const radians = (group.rot / turnsPerDegree) * (Math.PI / 180)
  const centreX = middleX + fromX * Math.cos(radians) - fromY * Math.sin(radians)
  const centreY = middleY + fromX * Math.sin(radians) + fromY * Math.cos(radians)
  const cx = Math.round(child.box.cx * scaleX)
  const cy = Math.round(child.box.cy * scaleY)
  const turn = (group.flipH !== group.flipV ? -child.rot : child.rot) + group.rot
  return {
    box: { x: Math.round(centreX - cx / 2) + 0, y: Math.round(centreY - cy / 2) + 0, cx, cy },
    rot: ((turn % fullTurn) + fullTurn) % fullTurn,
    flipH: child.flipH !== group.flipH,
    flipV: child.flipV !== group.flipV,
  }
}

export function memberPlace(member: Member): Place {
  return {
    box: member.box,
    rot: member.rot ?? 0,
    flipH: member.flipH === true,
    flipV: member.flipV === true,
  }
}

export function memberOf(node: ElementId, place: Place): Member {
  return {
    node,
    box: place.box,
    ...(place.rot === 0 ? {} : { rot: place.rot }),
    ...(place.flipH ? { flipH: true } : {}),
    ...(place.flipV ? { flipV: true } : {}),
  }
}

function designed(opening: IndexElement | undefined, key: "box.rot" | "box.flipH" | "box.flipV"): unknown {
  return opening?.design?.[key]?.[0]
}

export function openingPlace(opening: IndexElement | undefined): Place | null {
  if (opening?.box === null || opening?.box === undefined) return null
  return {
    box: opening.box,
    rot: turnOf(undefined, opening),
    flipH: flipOf(undefined, opening, "box.flipH"),
    flipV: flipOf(undefined, opening, "box.flipV"),
  }
}

function turnOf(edit: FieldEdit<unknown> | undefined, opening: IndexElement | undefined): number {
  if (typeof edit === "object" && typeof edit.set === "number") return edit.set
  const read = designed(opening, "box.rot")
  return typeof read === "number" ? Math.round(read * turnsPerDegree) % fullTurn : 0
}

function flipOf(
  edit: FieldEdit<unknown> | undefined,
  opening: IndexElement | undefined,
  key: "box.flipH" | "box.flipV",
): boolean {
  if (typeof edit === "object" && typeof edit.set === "boolean") return edit.set
  return designed(opening, key) === true
}

export function placeOf(register: Register, node: ElementId): Place | null {
  const opening = openingElement(register, node)
  const parent = groupParent(register, node)
  if (parent !== null) {
    const plain = parent !== undefined && frameBackdrop(register, parent) === null
    if (plain && heldSides(register, node).size > 0) return rowPlace(register, node)
    const member =
      parent === undefined
        ? undefined
        : (joinedMember(register, node) ??
          frameMembers(register, parent).find((m) => m.node === node) ??
          frameSource(register, parent)?.members.find((m) => m.node === node) ??
          madeGroup(register, parent)?.members.find((m) => m.node === node))
    return member === undefined ? openingPlace(opening) : memberPlace(member)
  }
  return rowPlace(register, node)
}

export function rowPlace(register: Register, node: ElementId): Place | null {
  const opening = openingElement(register, node)
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const box = (body === undefined ? null : currentBox(body)) ?? opening?.box ?? null
  if (box === null) return null
  const edits: Readonly<Record<string, FieldEdit<unknown>>> =
    (body === undefined ? undefined : landedPatch(body, "text").box) ?? {}
  return {
    box,
    rot: turnOf(edits.rot, opening),
    flipH: flipOf(edits.flipH, opening, "box.flipH"),
    flipV: flipOf(edits.flipV, opening, "box.flipV"),
  }
}

function samePlace(left: Place | null, right: Place): boolean {
  if (left === null) return false
  const [a, b] = [left.box, right.box]
  const boxed = a.x === b.x && a.y === b.y && a.cx === b.cx && a.cy === b.cy
  return boxed && left.rot === right.rot && left.flipH === right.flipH && left.flipV === right.flipV
}

export function huggedPlace(register: Register, node: ElementId, place: Place): Place {
  const size = huggedSize(register, node)
  return size === null ? place : { ...place, box: { ...place.box, cx: size.cx, cy: size.cy } }
}

export function rowsKept(register: Register, command: ElementGroup): boolean {
  const above = groupParent(register, command.element.node)
  const nested = typeof above === "string" && frameBackdrop(register, above) !== null
  const laid = nested ? readLayout(register, command.element.node) : null
  return command.members.every((member) => {
    const place = rowPlace(register, member.node)
    const box = laid?.children.find((child) => child.node === member.node)?.box
    const shown =
      place === null ? null : box === undefined ? huggedPlace(register, member.node, place) : { ...place, box }
    return samePlace(shown, memberPlace(member))
  })
}

export function groupOf(
  register: Register,
  slide: SlideId,
  node: ElementId,
  members: readonly ElementId[],
): ElementGroup | null {
  const placed: Member[] = []
  for (const member of members) {
    const place = placeOf(register, member)
    if (place === null || shapeOf(member).slide !== slide) return null
    placed.push(memberOf(member, place))
  }
  if (placed.length < 2) return null
  const element = { node, kind: "group", value: null, box: groupBounds(placed), grouped: false } as const
  return { slide: "element-group", id: slide, element, members: placed }
}

function sides(place: Place): Readonly<Record<string, number | boolean>> {
  return {
    x: place.box.x,
    y: place.box.y,
    w: place.box.cx,
    h: place.box.cy,
    rot: place.rot,
    flipH: place.flipH,
    flipV: place.flipV,
  }
}

export function boxEdits(
  own: Place,
  mapped: Place,
  held: ReadonlySet<string>,
  taken: readonly FieldKey[],
): ElementPatch {
  const before = sides(own)
  const box = Object.fromEntries(
    Object.entries(sides(mapped))
      .filter(
        ([field, value]) => taken.includes(`box.${field}` as FieldKey) && (value !== before[field] || held.has(field)),
      )
      .map(([field, value]) => [field, { set: value }]),
  )
  return Object.keys(box).length === 0 ? {} : { box }
}

export function heldSides(register: Register, node: ElementId): ReadonlySet<string> {
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const edits = body === undefined ? {} : (landedPatch(body, "text").box ?? {})
  return new Set(Object.entries(edits).flatMap(([field, edit]) => (typeof edit === "object" ? [field] : [])))
}

export type Freed = "laid" | "made"

function framedPlace(register: Register, node: ElementId, child: ElementId, place: Place, freed: Freed): Place | null {
  const view = readLayout(register, node)
  const group = frameSource(register, node)
  const made = group?.box
  if (view === null || made === undefined || made === null) return null
  const wrapped = group?.members.find((member) => member.node === child)
  const kept = wrapped !== undefined && frameMembers(register, node).includes(wrapped)
  if (freed === "made" && kept) {
    const box = { ...place.box, x: place.box.x + view.box.x - made.x, y: place.box.y + view.box.y - made.y }
    return { ...place, box }
  }
  const laid = view.children.find((each) => each.node === child)?.box
  return laid === undefined ? null : { ...place, box: laid }
}

function placedIn(place: Place, origin: Box | undefined): Place {
  return origin === undefined
    ? place
    : { ...place, box: { ...place.box, x: place.box.x - origin.x, y: place.box.y - origin.y } }
}

export function ungroupRows(register: Register, node: ElementId, freed: Freed = "laid"): readonly PlacedRow[] | null {
  const frame = groupFrame(register, node)
  const group = placeOf(register, node)
  if (frame === null || group === null) return null
  const backdrop = frameBackdrop(register, node)
  const above = groupParent(register, node)
  const into = typeof above === "string" ? frameNow(register, above) : null
  const origin = into === "free" && typeof above === "string" ? readLayout(register, above)?.box : undefined
  const rows: PlacedRow[] = []
  for (const child of groupChildren(register, node)) {
    const opening = openingElement(register, child)
    const place = placeOf(register, child)
    if (opening === undefined || place === null || child === backdrop) continue
    const facts: ElementFacts = {
      kind: opening.kind,
      text: opening.value !== null,
      grouped: into !== null,
      animated: false,
      ...(into === null ? {} : { framed: into }),
    }
    const target =
      backdrop === null ? throughGroup(place, group, frame) : framedPlace(register, node, child, place, freed)
    if (target === null) continue
    const held = origin === undefined ? heldSides(register, child) : new Set([...heldSides(register, child), "x", "y"])
    const patch = boxEdits(placedIn(place, origin), placedIn(target, origin), held, takes(facts))
    if (patch.box !== undefined) rows.push({ node: child, patch })
  }
  return rows
}

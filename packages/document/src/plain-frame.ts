import type { Box } from "./box.js"
import { decide, landedPatch, type Command, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { frameBackdrop, groupBounds, groupParent, type ElementGroup, type Member } from "./element-group.js"
import { format } from "./format.js"
import { memberOf, placeOf, type PlacedRow } from "./group-place.js"
import type { ElementPatch, FieldEdit } from "./row.js"
import { openingElement } from "./slide-floor.js"

const noPadding = { left: 0, top: 0, right: 0, bottom: 0 } as const

function boxSidesNow(register: Register, node: ElementId): Readonly<Record<string, unknown>> {
  const opening: Readonly<Record<string, FieldEdit<unknown>>> = openingElement(register, node)?.opening?.box ?? {}
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const landed: Readonly<Record<string, FieldEdit<unknown>>> =
    (body === undefined ? undefined : landedPatch(body, "text").box) ?? {}
  const now: Record<string, unknown> = {}
  for (const field of new Set([...Object.keys(opening), ...Object.keys(landed)])) {
    const edit = landed[field] === undefined || landed[field] === "opening" ? opening[field] : landed[field]
    if (typeof edit === "object") now[field] = edit.set
  }
  return now
}

function relativeRows(register: Register, members: readonly Member[], origin: Box): readonly PlacedRow[] {
  return members.flatMap((member): PlacedRow[] => {
    const sides = boxSidesNow(register, member.node)
    const box: Record<string, FieldEdit<number>> = {}
    if (typeof sides.x === "number") box.x = { set: sides.x - origin.x }
    if (typeof sides.y === "number") box.y = { set: sides.y - origin.y }
    return Object.keys(box).length === 0 ? [] : [{ node: member.node, patch: { box } }]
  })
}

function landedTurn(register: Register, commands: readonly Command[]): boolean {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: current.floor, route: current.route })
      if (opened.decision !== "apply") return false
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") return false
    current = decision.register
  }
  return true
}

export function plainFrameTurn(
  register: Register,
  file: readonly SlideId[],
  slide: SlideId,
  node: ElementId,
  backdrop: ElementId,
  nodes: readonly ElementId[],
): readonly Command[] | null {
  const members: Member[] = []
  for (const id of nodes) {
    const place = placeOf(register, id)
    if (place === null || shapeOf(id).slide !== slide || groupParent(register, id) !== null) return null
    if (frameBackdrop(register, id) !== null) return null
    members.push(memberOf(id, place))
  }
  if (members.length === 0 || new Set(nodes).size !== nodes.length) return null
  const box = groupBounds(members)
  const opening: ElementPatch = {
    layout: { flow: { set: "none" }, gap: { set: 0 }, padding: { set: noPadding }, align: { set: "topLeft" } },
  }
  const element: IndexElement = { node, kind: "group", value: null, box, grouped: false, opening }
  const back: IndexElement = { node: backdrop, kind: "shape", value: null, box, grouped: false }
  const edit: ElementGroup = { slide: "element-group", id: slide, element, members, backdrop: back }
  const wrap: Command = { command: "slide", file, edit }
  const formed = decide(register, wrap)
  if (formed.decision !== "apply") return null
  const rows = relativeRows(formed.register, members, box).map((row): Command => ({
    command: "person",
    v: format,
    patch: row.patch,
    node: row.node,
  }))
  const commands = [wrap, ...rows]
  return landedTurn(register, commands) ? commands : null
}

import type { Box } from "./box.js"
import { landedPatch, type Register } from "./decide.js"
import type { ElementId } from "./element-id.js"
import { frameMembers, groupBounds, type Member } from "./element-group.js"
import { readLayout } from "./frame-layout.js"
import { rowPlace, type PlacedRow } from "./group-place.js"
import type { FieldEdit } from "./row.js"
import { openingElement } from "./slide-floor.js"

function hiddenNow(register: Register, node: ElementId): boolean {
  const opening: Readonly<Record<string, FieldEdit<unknown>>> = openingElement(register, node)?.opening?.identity ?? {}
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const landed: Readonly<Record<string, FieldEdit<unknown>>> =
    (body === undefined ? undefined : landedPatch(body, "text").identity) ?? {}
  const edit = landed.hidden === undefined || landed.hidden === "opening" ? opening.hidden : landed.hidden
  return typeof edit === "object" && edit.set === true
}

function sameBox(left: Box, right: Box): boolean {
  return left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}

function childMember(register: Register, member: Member | undefined, node: ElementId, box: Box): Member {
  const rot = member?.rot ?? rowPlace(register, node)?.rot ?? 0
  return { node, box, ...(rot === 0 ? {} : { rot }) }
}

export function fitFrameRows(register: Register, node: ElementId): readonly PlacedRow[] | null {
  const view = readLayout(register, node)
  if (view === null || view.flow !== "none" || view.children.length === 0) return null
  const byNode = new Map(frameMembers(register, node).map((member) => [member.node, member]))
  const all = view.children.map((child) => childMember(register, byNode.get(child.node), child.node, child.box))
  const shown = all.filter((child) => !hiddenNow(register, child.node))
  const bounds = groupBounds(shown.length > 0 ? shown : all)
  if (sameBox(bounds, view.box)) return null
  const frame: PlacedRow = {
    node,
    patch: {
      box: { x: { set: bounds.x }, y: { set: bounds.y }, w: { set: bounds.cx }, h: { set: bounds.cy } },
    },
  }
  if (bounds.x === view.box.x && bounds.y === view.box.y) return [frame]
  const children = view.children.map((child): PlacedRow => ({
    node: child.node,
    patch: { box: { x: { set: child.box.x - bounds.x }, y: { set: child.box.y - bounds.y } } },
  }))
  return [frame, ...children]
}

export function fitFramesRows(register: Register, nodes: readonly ElementId[]): readonly PlacedRow[] | null {
  const seen = new Set<ElementId>()
  const rows: PlacedRow[] = []
  for (const node of nodes) {
    if (seen.has(node)) continue
    seen.add(node)
    const own = fitFrameRows(register, node)
    if (own !== null) rows.push(...own)
  }
  return rows.length === 0 ? null : rows
}

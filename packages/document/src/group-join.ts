import type { Box } from "./box.js"
import { decide, type Command, type Register } from "./decide.js"
import { readSlideId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { groupFlow, groupFrame, groupParent, plainGroup, type ElementJoin } from "./element-group.js"
import { layoutNodes, readLayout, type LayoutView } from "./frame-layout.js"
import { format } from "./format.js"
import { memberOf, placeOf, type PlacedRow } from "./group-place.js"
import { fittedBox, groupSpace, intoSpace, outOfSpace } from "./group-space.js"

export type Spot = { readonly frame: ElementId | null; readonly before: ElementId | null; readonly box: Box }

function personRows(rows: readonly PlacedRow[]): readonly Command[] {
  return rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node }))
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

function boxRow(node: ElementId, box: Box): PlacedRow {
  return { node, patch: { box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } } } }
}

function boxIn(register: Register, frame: ElementId | null, box: Box): Box | null {
  if (frame === null || !plainGroup(register, frame)) return box
  const space = groupSpace(register, frame)
  return space === null ? null : intoSpace(box, space)
}

function spotRows(register: Register, node: ElementId, spot: Spot): readonly PlacedRow[] {
  const { box } = spot
  if (spot.frame === null) return [boxRow(node, box)]
  if (plainGroup(register, spot.frame)) {
    const inside = boxIn(register, spot.frame, box)
    return inside === null ? [] : [boxRow(node, inside)]
  }
  const view = readLayout(register, spot.frame)
  if (view === null || view.flow !== "none") return []
  return [{ node, patch: { box: { x: { set: box.x - view.box.x }, y: { set: box.y - view.box.y } } } }]
}

export function joinEdit(register: Register, node: ElementId, spot: Spot): ElementJoin | null {
  const slide = readSlideId(shapeOf(node).slide)
  const place = placeOf(register, node)
  const box = boxIn(register, spot.frame, spot.box)
  if (slide === undefined || place === null || box === null) return null
  const member = memberOf(node, { ...place, box })
  return { slide: "element-join", id: slide, member, frame: spot.frame, before: spot.before }
}

export function joinTurn(
  register: Register,
  file: readonly SlideId[],
  node: ElementId,
  spot: Spot,
): readonly Command[] | null {
  const edit = joinEdit(register, node, spot)
  if (edit === null) return null
  const joined = decide(register, { command: "slide", file, edit })
  if (joined.decision !== "apply") return null
  const fitted = fittedRows(register, joined.register, [groupParent(register, node), spot.frame])
  const commands = [
    { command: "slide" as const, file, edit },
    ...personRows([...spotRows(register, node, spot), ...fitted]),
  ]
  return landedTurn(register, commands) ? commands : null
}

function fittedRows(
  register: Register,
  joined: Register,
  groups: readonly (ElementId | null | undefined)[],
): readonly PlacedRow[] {
  return [...new Set(groups)].flatMap((group): PlacedRow[] => {
    if (typeof group !== "string" || !plainGroup(joined, group)) return []
    const place = placeOf(register, group)
    const frame = groupFrame(register, group)
    const fitted = groupFrame(joined, group)
    if (place === null || frame === null || fitted === null) return []
    return [boxRow(group, fittedBox(place.box, frame, fitted))]
  })
}

function centre(box: Box): { readonly x: number; readonly y: number } {
  return { x: box.x + box.cx / 2, y: box.y + box.cy / 2 }
}

function holds(box: Box, point: { readonly x: number; readonly y: number }): boolean {
  return point.x >= box.x && point.x <= box.x + box.cx && point.y >= box.y && point.y <= box.y + box.cy
}

function nextInFlow(view: LayoutView, node: ElementId, box: Box): ElementId | null {
  const along = (each: Box) => (view.flow === "vertical" ? centre(each).y : centre(each).x)
  const at = along(box)
  return view.children.find((child) => child.node !== node && along(child.box) > at)?.node ?? null
}

export function spotNow(register: Register, node: ElementId): Spot | null {
  const parent = groupParent(register, node)
  if (typeof parent === "string" && plainGroup(register, parent)) {
    const space = groupSpace(register, parent)
    const place = placeOf(register, node)
    if (space === null || place === null) return null
    const flow = groupFlow(register, parent)
    return { frame: parent, before: flow[flow.indexOf(node) + 1] ?? null, box: outOfSpace(place.box, space) }
  }
  const laid = parent === null || parent === undefined ? undefined : readLayout(register, parent)
  if (laid === null || laid === undefined) {
    const place = placeOf(register, node)
    return parent === null && place !== null ? { frame: null, before: null, box: place.box } : null
  }
  const at = laid.children.findIndex((child) => child.node === node)
  const box = laid.children[at]?.box
  if (box === undefined) return null
  return { frame: laid.node, before: laid.children[at + 1]?.node ?? null, box }
}

export function dropSpot(register: Register, node: ElementId, box: Box): Spot | "kept" | null {
  const now = spotNow(register, node)
  if (now === null || (now.frame !== null && plainGroup(register, now.frame))) return null
  const point = centre(box)
  const slide = shapeOf(node).slide
  const frames = layoutNodes(register).flatMap((frame) => {
    const view = frame === node || shapeOf(frame).slide !== slide ? null : readLayout(register, frame)
    return view !== null && holds(view.box, point) ? [view] : []
  })
  const target = frames.find((view) => view.node === now.frame) ?? frames.at(-1)
  if (target === undefined) return now.frame === null ? null : { frame: null, before: null, box }
  if (target.flow === "none") return target.node === now.frame ? null : { frame: target.node, before: null, box }
  const before = nextInFlow(target, node, box)
  if (target.node === now.frame && before === now.before) return "kept"
  return { frame: target.node, before, box }
}

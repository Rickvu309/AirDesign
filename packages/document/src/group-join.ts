import type { Box } from "./box.js"
import { decide, type Command, type Register } from "./decide.js"
import { readSlideId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import {
  frameBackdrop,
  groupChildren,
  groupDissolved,
  groupFlow,
  groupParent,
  plainGroup,
  type ElementJoin,
} from "./element-group.js"
import { elementGone } from "./element-order.js"
import { takes } from "./element-takes.js"
import { layoutDepth, layoutNodes, readLayout, type LayoutView } from "./frame-layout.js"
import { format } from "./format.js"
import { memberOf, memberPlace, placeOf, rowPlace, type Place, type PlacedRow } from "./group-place.js"
import { shownPlace, slideAligned, storedPlaceIn } from "./group-space.js"
import type { ElementPatch } from "./row.js"
import { openingElement } from "./slide-floor.js"

export type Spot = { readonly frame: ElementId | null; readonly before: ElementId | null; readonly box: Box }

function personRows(rows: readonly PlacedRow[]): readonly Command[] {
  return rows.map((row): Command => ({ command: "person", v: format, patch: row.patch, node: row.node }))
}

function landed(register: Register, commands: readonly Command[]): Register | null {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = decide(current, { command: "add", node, floor: current.floor, route: current.route })
      if (opened.decision !== "apply") return null
      current = opened.register
    }
    const decision = decide(current, command)
    if (decision.decision !== "apply") return null
    current = decision.register
  }
  return current
}

function framedIn(register: Register, node: ElementId): boolean {
  const parent = groupParent(register, node)
  return typeof parent === "string" && frameBackdrop(register, parent) !== null
}

function placeOnSlide(register: Register, node: ElementId): Place | null {
  return shownPlace(register, node) ?? (framedIn(register, node) ? placeOf(register, node) : null)
}

function joinedPlace(register: Register, node: ElementId, spot: Spot): Place | null {
  const shown = placeOnSlide(register, node)
  if (shown === null) return null
  const wanted = { ...shown, box: spot.box }
  if (spot.frame !== null && !plainGroup(register, spot.frame)) return wanted
  if (spot.frame !== null && frameBackdrop(register, node) !== null && !slideAligned(register, spot.frame)) return null
  return storedPlaceIn(register, node, spot.frame, wanted)
}

export function joinEdit(register: Register, node: ElementId, spot: Spot): ElementJoin | null {
  const slide = readSlideId(shapeOf(node).slide)
  const place = joinedPlace(register, node, spot)
  if (slide === undefined || place === null) return null
  return { slide: "element-join", id: slide, member: memberOf(node, place), frame: spot.frame, before: spot.before }
}

function placedRows(register: Register, node: ElementId, place: Place): readonly PlacedRow[] | null {
  const opening = openingElement(register, node)
  const now = rowPlace(register, node)
  if (opening === undefined || now === null) return null
  const taken = takes({ kind: opening.kind, text: opening.value !== null, grouped: true, animated: false })
  const { x, y, cx, cy } = place.box
  const box: Record<string, { readonly set: number | boolean }> = {
    x: { set: x },
    y: { set: y },
    w: { set: cx },
    h: { set: cy },
  }
  const turns = { rot: [place.rot, now.rot], flipH: [place.flipH, now.flipH], flipV: [place.flipV, now.flipV] }
  for (const [field, [wanted, held]] of Object.entries(turns)) {
    if (wanted === held || wanted === undefined) continue
    if (!taken.some((key) => key === `box.${field}`)) return null
    box[field] = { set: wanted }
  }
  const patch: ElementPatch = { box }
  return [{ node, patch }]
}

function spotRows(register: Register, node: ElementId, spot: Spot, place: Place): readonly PlacedRow[] | null {
  if (spot.frame === null || plainGroup(register, spot.frame)) return placedRows(register, node, place)
  const view = readLayout(register, spot.frame)
  if (view === null || view.flow !== "none") return []
  return [{ node, patch: { box: { x: { set: spot.box.x - view.box.x }, y: { set: spot.box.y - view.box.y } } } }]
}

function removedGroups(register: Register, frame: ElementId | null): readonly ElementId[] {
  const gone: ElementId[] = []
  for (
    let group: ElementId | null | undefined = frame;
    typeof group === "string";
    group = groupParent(register, group)
  ) {
    if (!elementGone(register, group) || groupDissolved(register, group)) break
    gone.push(group)
  }
  return gone.toReversed()
}

function emptiedGroups(register: Register, left: ElementId | null | undefined): readonly ElementId[] {
  const emptied: ElementId[] = []
  for (
    let group = left;
    typeof group === "string" && plainGroup(register, group);
    group = groupParent(register, group)
  ) {
    const holds = groupChildren(register, group).some(
      (child) => !elementGone(register, child) && !emptied.includes(child),
    )
    if (holds) break
    emptied.push(group)
  }
  return emptied
}

function slideCommands(
  file: readonly SlideId[],
  slide: "element-remove" | "element-restore",
  groups: readonly ElementId[],
): readonly Command[] {
  return groups.flatMap((node): Command[] => {
    const id = readSlideId(shapeOf(node).slide)
    return id === undefined ? [] : [{ command: "slide", file, edit: { slide, id, node } }]
  })
}

export function joinTurn(
  register: Register,
  file: readonly SlideId[],
  node: ElementId,
  spot: Spot,
): readonly Command[] | null {
  const restores = slideCommands(file, "element-restore", removedGroups(register, spot.frame))
  const opened = landed(register, restores)
  const edit = opened === null ? null : joinEdit(opened, node, spot)
  if (opened === null || edit === null) return null
  const joined = decide(opened, { command: "slide", file, edit })
  if (joined.decision !== "apply") return null
  const left = groupParent(opened, node)
  const emptied = emptiedGroups(joined.register, left)
  const placed = spotRows(opened, node, spot, memberPlace(edit.member))
  if (placed === null) return null
  const commands = [
    ...restores,
    { command: "slide" as const, file, edit },
    ...personRows(placed),
    ...slideCommands(file, "element-remove", emptied),
  ]
  return landed(register, commands) === null ? null : commands
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
    const shown = shownPlace(register, node)
    if (shown === null) return null
    const flow = groupFlow(register, parent)
    return { frame: parent, before: flow[flow.indexOf(node) + 1] ?? null, box: shown.box }
  }
  const laid = parent === null || parent === undefined ? undefined : readLayout(register, parent)
  if (laid === null || laid === undefined) {
    const place = shownPlace(register, node)
    return parent === null && place !== null ? { frame: null, before: null, box: place.box } : null
  }
  const at = laid.children.findIndex((child) => child.node === node)
  const box = laid.children[at]?.box
  if (box === undefined) return null
  return { frame: laid.node, before: laid.children[at + 1]?.node ?? null, box }
}

function inside(register: Register, frame: ElementId, node: ElementId): boolean {
  for (let above: ElementId | null | undefined = frame; typeof above === "string"; above = groupParent(register, above))
    if (above === node) return true
  return false
}

export function dropSpot(register: Register, node: ElementId, box: Box): Spot | "kept" | null {
  const now = spotNow(register, node)
  if (now === null || (now.frame !== null && plainGroup(register, now.frame))) return null
  const point = centre(box)
  const slide = shapeOf(node).slide
  const frames = layoutNodes(register).flatMap((frame) => {
    const view = shapeOf(frame).slide !== slide || inside(register, frame, node) ? null : readLayout(register, frame)
    return view !== null && holds(view.box, point) ? [{ view, depth: layoutDepth(register, frame) }] : []
  })
  const deepest = Math.max(...frames.map(({ depth }) => depth))
  const innermost = frames.filter(({ depth }) => depth === deepest).map(({ view }) => view)
  const target = innermost.find((view) => view.node === now.frame) ?? innermost.at(-1)
  if (target === undefined) return now.frame === null ? null : { frame: null, before: null, box }
  if (target.flow === "none") return target.node === now.frame ? null : { frame: target.node, before: null, box }
  const before = nextInFlow(target, node, box)
  if (target.node === now.frame && before === now.before) return "kept"
  return { frame: target.node, before, box }
}

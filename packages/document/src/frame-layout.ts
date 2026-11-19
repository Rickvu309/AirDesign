import type { Box } from "./box.js"
import { decide, landedPatch, type Command, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { readSlideId, shapeOf, type ElementId, type SlideId } from "./element-id.js"
import { format } from "./format.js"
import {
  frameBackdrop,
  frameMembers,
  groupBounds,
  groupParent,
  frameSource,
  type ElementGroup,
  type FrameSource,
  type ElementJoin,
  type Member,
} from "./element-group.js"
import { memberOf, placeOf, type PlacedRow } from "./group-place.js"
import type { ElementPatch, FieldEdit } from "./row.js"
import { floorOf, openingElement } from "./slide-floor.js"
import type { Framing } from "./frame-index.js"
import { flows, layoutAligns } from "./trait-layout.js"

export type Flow = (typeof flows)[number]
export type LayoutAlign = (typeof layoutAligns)[number]
export type Sides = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export type LayoutChild = { readonly node: ElementId; readonly box: Box }

export type LayoutView = {
  readonly node: ElementId
  readonly backdrop: ElementId
  readonly flow: Flow
  readonly gap: number
  readonly padding: Sides
  readonly align: LayoutAlign
  readonly box: Box
  readonly children: readonly LayoutChild[]
}

export type Framed = "auto" | "free"

export type LayoutIntent =
  | {
      readonly wrap: readonly ElementId[]
      readonly slide: SlideId
      readonly node: ElementId
      readonly backdrop: ElementId
    }
  | { readonly remove: ElementId }
  | { readonly reflow: ElementId }
  | { readonly place: ElementId; readonly box: Box; readonly file: readonly SlideId[] }

const point = 12_700
const noPadding: Sides = { left: 0, top: 0, right: 0, bottom: 0 }

type Fields = Readonly<Record<string, unknown>>

function traitNow(register: Register, node: ElementId, trait: "layout" | "identity" | "box"): Fields {
  const filed = trait === "layout" ? filedLayout(openingElement(register, node)?.framing) : undefined
  const opening: Readonly<Record<string, FieldEdit<unknown>>> =
    filed ?? openingElement(register, node)?.opening?.[trait] ?? {}
  const body = Object.hasOwn(register.elements, node) ? register.elements[node] : undefined
  const landed: Readonly<Record<string, FieldEdit<unknown>>> =
    (body === undefined ? undefined : landedPatch(body, "text")[trait]) ?? {}
  const now: Record<string, unknown> = {}
  for (const field of new Set([...Object.keys(opening), ...Object.keys(landed)])) {
    const edit = landed[field] === undefined || landed[field] === "opening" ? opening[field] : landed[field]
    if (typeof edit === "object") now[field] = edit.set
  }
  return now
}

function filedLayout(framing: Framing | undefined): Readonly<Record<string, FieldEdit<unknown>>> | undefined {
  if (framing === undefined) return undefined
  const { flow, gap, padding, align } = framing.layout
  const [left, top, right, bottom] = padding
  return {
    flow: { set: flow },
    gap: { set: gap },
    padding: { set: { left, top, right, bottom } },
    align: { set: align },
  }
}

function flowOf(fields: Fields): Flow {
  return flows.find((flow) => flow === fields.flow) ?? "none"
}

function sidesOf(value: unknown): Sides {
  if (typeof value !== "object" || value === null) return noPadding
  const sides = value as Partial<Sides>
  return {
    left: sides.left ?? 0,
    top: sides.top ?? 0,
    right: sides.right ?? 0,
    bottom: sides.bottom ?? 0,
  }
}

function crossShare(flow: Flow, align: LayoutAlign): number {
  const name = align.toLowerCase()
  if (flow === "horizontal") return name.startsWith("top") ? 0 : name.startsWith("bottom") ? 1 : 0.5
  return name.endsWith("left") ? 0 : name.endsWith("right") ? 1 : 0.5
}

function whole(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback
}

function boxNow(register: Register, node: ElementId, fallback: Box): Box {
  const sides = traitNow(register, node, "box")
  return {
    x: whole(sides.x, fallback.x),
    y: whole(sides.y, fallback.y),
    cx: whole(sides.w, fallback.cx),
    cy: whole(sides.h, fallback.cy),
  }
}

function childBox(register: Register, member: Member): Box {
  const own = boxNow(register, member.node, member.box)
  return { ...member.box, cx: own.cx, cy: own.cy }
}

function hiddenNow(register: Register, node: ElementId): boolean {
  return traitNow(register, node, "identity").hidden === true
}

function frameOrigin(register: Register, node: ElementId, made: FrameSource): Box {
  return boxNow(register, node, made.box)
}

function laidOut(
  register: Register,
  made: FrameSource,
  members: readonly Member[],
  origin: Box,
  fields: {
    readonly flow: Exclude<Flow, "none">
    readonly gap: number
    readonly padding: Sides
    readonly align: LayoutAlign
  },
): { readonly box: Box; readonly children: readonly LayoutChild[] } {
  const horizontal = fields.flow === "horizontal"
  const shown = members.filter((member) => !hiddenNow(register, member.node))
  const slots = shown.map((member) => {
    const box = childBox(register, member)
    const bounds = groupBounds([{ ...member, box }])
    return { member, box, bounds }
  })
  const along = (box: Box) => (horizontal ? box.cx : box.cy)
  const across = (box: Box) => (horizontal ? box.cy : box.cx)
  const thickest = Math.max(0, ...slots.map(({ bounds }) => across(bounds)))
  const { padding, gap } = fields
  const start = horizontal ? padding.left : padding.top
  const crossStart = horizontal ? padding.top : padding.left
  const share = crossShare(fields.flow, fields.align)
  const children: LayoutChild[] = []
  let cursor = start
  for (const { member, box, bounds } of slots) {
    const cross = crossStart + Math.round((thickest - across(bounds)) * share)
    const slotX = origin.x + (horizontal ? cursor : cross)
    const slotY = origin.y + (horizontal ? cross : cursor)
    children.push({ node: member.node, box: { ...box, x: slotX + box.x - bounds.x, y: slotY + box.y - bounds.y } })
    cursor += along(bounds) + gap
  }
  const opened = made.box
  for (const member of members.filter((each) => !shown.includes(each))) {
    const box = childBox(register, member)
    children.push({
      node: member.node,
      box: { ...box, x: origin.x + box.x - opened.x, y: origin.y + box.y - opened.y },
    })
  }
  const used = slots.length === 0 ? start : cursor - gap
  const length = used + (horizontal ? padding.right : padding.bottom)
  const thickness = crossStart + thickest + (horizontal ? padding.bottom : padding.right)
  const box = {
    x: origin.x,
    y: origin.y,
    cx: horizontal ? length : thickness,
    cy: horizontal ? thickness : length,
  }
  return { box, children }
}

function heldFree(
  register: Register,
  made: FrameSource,
  members: readonly Member[],
  origin: Box,
): readonly LayoutChild[] {
  const opened = made.box
  return members.map((member) => {
    const box = boxNow(register, member.node, { ...member.box, x: member.box.x - opened.x, y: member.box.y - opened.y })
    return { node: member.node, box: { ...box, x: origin.x + box.x, y: origin.y + box.y } }
  })
}

export function readLayout(register: Register, node: ElementId): LayoutView | null {
  const backdrop = frameBackdrop(register, node)
  const made = frameSource(register, node)
  if (backdrop === null || made === null) return null
  const fields = traitNow(register, node, "layout")
  const flow = flowOf(fields)
  const gap = typeof fields.gap === "number" ? fields.gap : 0
  const padding = sidesOf(fields.padding)
  const align = layoutAligns.find((each) => each === fields.align) ?? "topLeft"
  const origin = frameOrigin(register, node, made)
  const view = { node, backdrop, flow, gap, padding, align }
  const members = frameMembers(register, node)
  if (flow === "none") return { ...view, box: origin, children: heldFree(register, made, members, origin) }
  return { ...view, ...laidOut(register, made, members, origin, { flow, gap, padding, align }) }
}

export function layoutNodes(register: Register): readonly ElementId[] {
  const filed = [...(register.index?.elements ?? []), ...register.order.flatMap((command) => floorOf(command))]
  const opened = filed.flatMap((element) =>
    element.framing !== undefined && frameBackdrop(register, element.node) !== null ? [element.node] : [],
  )
  return [...new Set(opened)].concat(made(register))
}

function made(register: Register): readonly ElementId[] {
  return register.order.flatMap((command) =>
    command.slide === "element-group" &&
    command.backdrop !== undefined &&
    frameBackdrop(register, command.element.node) !== null
      ? [command.element.node]
      : [],
  )
}

export function framedNow(register: Register, node: ElementId): Framed | null {
  const parent = groupParent(register, node)
  if (parent === null || parent === undefined || frameBackdrop(register, parent) === null) return null
  return flowOf(traitNow(register, parent, "layout")) === "none" ? "free" : "auto"
}

export function frameNow(register: Register, node: ElementId): Framed | null {
  if (frameBackdrop(register, node) === null) return null
  return flowOf(traitNow(register, node, "layout")) === "none" ? "free" : "auto"
}

function spread(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values)
}

function middle(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const half = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[half] ?? 0) : ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2
}

function guessed(members: readonly Member[]): {
  readonly flow: Exclude<Flow, "none">
  readonly gap: number
  readonly align: LayoutAlign
  readonly order: readonly Member[]
} {
  const bounds = members.map((member) => ({ member, box: groupBounds([member]) }))
  const centresX = bounds.map(({ box }) => box.x + box.cx / 2)
  const centresY = bounds.map(({ box }) => box.y + box.cy / 2)
  const horizontal = spread(centresX) >= spread(centresY)
  const order = [...bounds].sort((left, right) => (horizontal ? left.box.x - right.box.x : left.box.y - right.box.y))
  const gaps = order.slice(1).map((each, at) => {
    const before = order[at]?.box ?? each.box
    return horizontal ? each.box.x - (before.x + before.cx) : each.box.y - (before.y + before.cy)
  })
  const gap = gaps.length === 0 ? 0 : Math.max(0, Math.round(middle(gaps) / point) * point)
  const starts = order.map(({ box }) => (horizontal ? box.y : box.x))
  const centres = horizontal ? centresY : centresX
  const ends = order.map(({ box }) => (horizontal ? box.y + box.cy : box.x + box.cx))
  const fits = [spread(starts), spread(centres), spread(ends)]
  const best = fits.indexOf(Math.min(...fits))
  const named: readonly (readonly [LayoutAlign, LayoutAlign])[] = [
    ["topLeft", "topLeft"],
    ["left", "top"],
    ["bottomLeft", "topRight"],
  ]
  const align = named[best]?.[horizontal ? 0 : 1] ?? "topLeft"
  return { flow: horizontal ? "horizontal" : "vertical", gap, align, order: order.map(({ member }) => member) }
}

function wrapped(register: Register, intent: Extract<LayoutIntent, { readonly wrap: unknown }>): ElementGroup | null {
  const members: Member[] = []
  for (const node of intent.wrap) {
    const place = placeOf(register, node)
    if (place === null || shapeOf(node).slide !== intent.slide || groupParent(register, node) !== null) return null
    if (frameBackdrop(register, node) !== null) return null
    members.push(memberOf(node, place))
  }
  if (members.length === 0 || new Set(intent.wrap).size !== intent.wrap.length) return null
  const { flow, gap, align, order } = guessed(members)
  const box = groupBounds(members)
  const opening: ElementPatch = {
    layout: { flow: { set: flow }, gap: { set: gap }, padding: { set: noPadding }, align: { set: align } },
  }
  const element: IndexElement = { node: intent.node, kind: "group", value: null, box, grouped: false, opening }
  const backdrop: IndexElement = { node: intent.backdrop, kind: "shape", value: null, box, grouped: false }
  return { slide: "element-group", id: intent.slide, element, members: order, backdrop }
}

function frozen(register: Register, node: ElementId): readonly PlacedRow[] | null {
  const view = readLayout(register, node)
  if (view === null || view.flow === "none") return null
  const { box } = view
  const frame: PlacedRow = {
    node,
    patch: {
      layout: { flow: { set: "none" } },
      box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } },
    },
  }
  const children = view.children.map((child): PlacedRow => ({
    node: child.node,
    patch: { box: { x: { set: child.box.x - box.x }, y: { set: child.box.y - box.y } } },
  }))
  return [frame, ...children]
}

export function refrozenRows(register: Register, node: ElementId): readonly PlacedRow[] {
  const made = frameSource(register, node)
  if (made === null || frameNow(register, node) !== "free") return []
  const origin = frameOrigin(register, node, made)
  return frameMembers(register, node).flatMap((member): PlacedRow[] => {
    const sides = traitNow(register, member.node, "box")
    if (typeof sides.x !== "number" || typeof sides.y !== "number") return []
    return [{ node: member.node, patch: { box: { x: { set: sides.x - origin.x }, y: { set: sides.y - origin.y } } } }]
  })
}

function reflowed(register: Register, node: ElementId): readonly PlacedRow[] | null {
  const view = readLayout(register, node)
  if (view === null || view.flow !== "none" || view.children.length === 0) return null
  const { flow, gap, align } = guessed(view.children.map((child) => ({ node: child.node, box: child.box })))
  return [{ node, patch: { layout: { flow: { set: flow }, gap: { set: gap }, align: { set: align } } } }]
}

export function changeLayout(
  register: Register,
  intent: LayoutIntent,
):
  | { readonly slide: ElementGroup }
  | { readonly rows: readonly PlacedRow[] }
  | { readonly turn: readonly Command[] }
  | null {
  if ("wrap" in intent) {
    const slide = wrapped(register, intent)
    return slide === null ? null : { slide }
  }
  if ("place" in intent) {
    const spot = dropSpot(register, intent.place, intent.box)
    if (spot === "kept") return { turn: [] }
    const turn = spot === null ? null : joinTurn(register, intent.file, intent.place, spot)
    return turn === null ? null : { turn }
  }
  const rows = "remove" in intent ? frozen(register, intent.remove) : reflowed(register, intent.reflow)
  return rows === null ? null : { rows }
}

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

function spotRows(register: Register, node: ElementId, spot: Spot): readonly PlacedRow[] {
  const { box } = spot
  if (spot.frame === null)
    return [{ node, patch: { box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } } } }]
  const view = readLayout(register, spot.frame)
  if (view === null || view.flow !== "none") return []
  return [{ node, patch: { box: { x: { set: box.x - view.box.x }, y: { set: box.y - view.box.y } } } }]
}

export function joinTurn(
  register: Register,
  file: readonly SlideId[],
  node: ElementId,
  spot: Spot,
): readonly Command[] | null {
  const slide = readSlideId(shapeOf(node).slide)
  const place = placeOf(register, node)
  if (slide === undefined || place === null) return null
  const member = memberOf(node, { ...place, box: spot.box })
  const edit: ElementJoin = { slide: "element-join", id: slide, member, frame: spot.frame, before: spot.before }
  const commands = [{ command: "slide" as const, file, edit }, ...personRows(spotRows(register, node, spot))]
  return landedTurn(register, commands) ? commands : null
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

function dropSpot(register: Register, node: ElementId, box: Box): Spot | "kept" | null {
  const now = spotNow(register, node)
  if (now === null) return null
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

import type { Box } from "./box.js"
import { opaque } from "./color.js"
import { landedPatch, type Command, type Register } from "./decide.js"
import type { IndexElement } from "./deck-index.js"
import { shapeOf, type ElementId, type SlideId } from "./element-id.js"
import {
  frameBackdrop,
  frameMembers,
  groupFrame,
  groupBounds,
  groupParent,
  frameSource,
  plainGroup,
  type ElementGroup,
  type FrameSource,
  type Member,
} from "./element-group.js"
import { huggedPlace, memberOf, placeOf, type PlacedRow } from "./group-place.js"
import { dropSpot, joinTurn, spotNow } from "./group-join.js"
import { rebased } from "./group-space.js"
import type { ElementPatch, FieldEdit } from "./row.js"
import { floorOf, openingElement } from "./slide-floor.js"
import type { Framing } from "./frame-index.js"
import { flows, layoutAligns, sizings } from "./trait-layout.js"
import type { Alpha } from "./value-kind.js"
import { guessed } from "./layout-guess.js"

export type Flow = (typeof flows)[number]
export type LayoutAlign = (typeof layoutAligns)[number]
export type Sizing = (typeof sizings)[number]
export type Sides = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export type LayoutChild = { readonly node: ElementId; readonly box: Box }

export type LayoutView = {
  readonly node: ElementId
  readonly backdrop: ElementId
  readonly flow: Flow
  readonly gap: number
  readonly padding: Sides
  readonly align: LayoutAlign
  readonly opacity: Alpha
  readonly width: Sizing
  readonly height: Sizing
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
  | {
      readonly move: ElementId
      readonly frame: ElementId | null
      readonly before?: ElementId | null
      readonly file: readonly SlideId[]
    }

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
  const { flow, gap, padding, align, width, height } = framing.layout
  const [left, top, right, bottom] = padding
  return {
    flow: { set: flow },
    gap: { set: gap },
    padding: { set: { left, top, right, bottom } },
    align: { set: align },
    ...(width === undefined ? {} : { width: { set: width } }),
    ...(height === undefined ? {} : { height: { set: height } }),
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

function shareAcross(align: LayoutAlign, horizontal: boolean): number {
  const name = align.toLowerCase()
  if (horizontal) return name.endsWith("left") ? 0 : name.endsWith("right") ? 1 : 0.5
  return name.startsWith("top") ? 0 : name.startsWith("bottom") ? 1 : 0.5
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

type Settled = (node: ElementId) => Box | null

type Mode = "settled" | "unsettled"

const unsettled: Settled = () => null

function settledOf(register: Register, mode: Mode): Settled {
  if (mode === "unsettled") return unsettled
  return (child) => (groupFrame(register, child) === null ? null : (rebased(register, child)?.place.box ?? null))
}

function holderOf(register: Register, node: ElementId): ElementId | null {
  const parent = groupParent(register, node)
  return typeof parent === "string" && frameBackdrop(register, parent) !== null ? parent : null
}

function memo<T>(
  kept: WeakMap<Register, Map<ElementId, T | null>>,
  register: Register,
  node: ElementId,
  made: () => T | null,
) {
  const known = kept.get(register) ?? new Map<ElementId, T | null>()
  kept.set(register, known)
  if (known.has(node)) return known.get(node) ?? null
  known.set(node, null)
  const found = made()
  known.set(node, found)
  return found
}

const views: Readonly<Record<Mode, WeakMap<Register, Map<ElementId, LayoutView | null>>>> = {
  settled: new WeakMap(),
  unsettled: new WeakMap(),
}

const sizes: Readonly<Record<Mode, WeakMap<Register, Map<ElementId, Box | null>>>> = {
  settled: new WeakMap(),
  unsettled: new WeakMap(),
}

function frameSize(register: Register, node: ElementId, mode: Mode): Box | null {
  return memo(sizes[mode], register, node, () => {
    const made = frameSource(register, node)
    return made === null ? null : (arranged(register, node, boxNow(register, node, made.box), mode)?.box ?? null)
  })
}

function sizeOf(register: Register, member: Member, mode: Mode): Box {
  const framed = frameBackdrop(register, member.node) === null ? null : frameSize(register, member.node, mode)
  return framed ?? settledOf(register, mode)(member.node) ?? boxNow(register, member.node, member.box)
}

function childBox(register: Register, member: Member, mode: Mode): Box {
  const own = sizeOf(register, member, mode)
  return { ...member.box, cx: own.cx, cy: own.cy }
}

function hiddenNow(register: Register, node: ElementId): boolean {
  return traitNow(register, node, "identity").hidden === true
}

function originOf(register: Register, node: ElementId, made: FrameSource, mode: Mode): Box {
  const own = boxNow(register, node, made.box)
  const holder = holderOf(register, node)
  const slot =
    holder === null ? undefined : layoutIn(register, holder, mode)?.children.find((each) => each.node === node)
  return slot === undefined ? own : { ...slot.box, cx: own.cx, cy: own.cy }
}

function laidOut(
  register: Register,
  made: FrameSource,
  members: readonly Member[],
  origin: Box,
  mode: Mode,
  fields: {
    readonly flow: Exclude<Flow, "none">
    readonly gap: number
    readonly padding: Sides
    readonly align: LayoutAlign
    readonly width: Sizing
    readonly height: Sizing
  },
): { readonly box: Box; readonly children: readonly LayoutChild[] } {
  const horizontal = fields.flow === "horizontal"
  const shown = members.filter((member) => !hiddenNow(register, member.node))
  const slots = shown.map((member) => {
    const box = childBox(register, member, mode)
    const bounds = groupBounds([{ ...member, box }])
    return { member, box, bounds }
  })
  const along = (box: Box) => (horizontal ? box.cx : box.cy)
  const across = (box: Box) => (horizontal ? box.cy : box.cx)
  const thickest = Math.max(0, ...slots.map(({ bounds }) => across(bounds)))
  const { padding, gap } = fields
  const [start, end] = horizontal ? [padding.left, padding.right] : [padding.top, padding.bottom]
  const [crossStart, crossEnd] = horizontal ? [padding.top, padding.bottom] : [padding.left, padding.right]
  const [fixedAlong, fixedAcross] = horizontal ? [fields.width, fields.height] : [fields.height, fields.width]
  const content = slots.reduce((sum, { bounds }) => sum + along(bounds), 0) + gap * Math.max(0, slots.length - 1)
  const length = fixedAlong === "fixed" ? along(origin) : start + content + end
  const thickness = fixedAcross === "fixed" ? across(origin) : crossStart + thickest + crossEnd
  const room = thickness - crossStart - crossEnd
  const share = shareAcross(fields.align, !horizontal)
  const children: LayoutChild[] = []
  let cursor = start + Math.round((length - start - end - content) * shareAcross(fields.align, horizontal))
  for (const { member, box, bounds } of slots) {
    const cross = crossStart + Math.round((room - across(bounds)) * share)
    const slotX = origin.x + (horizontal ? cursor : cross)
    const slotY = origin.y + (horizontal ? cross : cursor)
    children.push({ node: member.node, box: { ...box, x: slotX + box.x - bounds.x, y: slotY + box.y - bounds.y } })
    cursor += along(bounds) + gap
  }
  const opened = made.box
  for (const member of members.filter((each) => !shown.includes(each))) {
    const box = childBox(register, member, mode)
    children.push({
      node: member.node,
      box: { ...box, x: origin.x + box.x - opened.x, y: origin.y + box.y - opened.y },
    })
  }
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
  mode: Mode,
): readonly LayoutChild[] {
  const opened = made.box
  return members.map((member) => {
    const framed = frameBackdrop(register, member.node) === null ? null : frameSize(register, member.node, mode)
    const fitted = framed === null ? settledOf(register, mode)(member.node) : null
    if (fitted !== null) return { node: member.node, box: fitted }
    const box = boxNow(register, member.node, { ...member.box, x: member.box.x - opened.x, y: member.box.y - opened.y })
    const size = framed ?? box
    return { node: member.node, box: { x: origin.x + box.x, y: origin.y + box.y, cx: size.cx, cy: size.cy } }
  })
}

function arranged(register: Register, node: ElementId, origin: Box, mode: Mode): LayoutView | null {
  const backdrop = frameBackdrop(register, node)
  const made = frameSource(register, node)
  if (backdrop === null || made === null) return null
  const fields = traitNow(register, node, "layout")
  const flow = flowOf(fields)
  const gap = typeof fields.gap === "number" ? fields.gap : 0
  const padding = sidesOf(fields.padding)
  const align = layoutAligns.find((each) => each === fields.align) ?? "topLeft"
  const opacity = (typeof fields.opacity === "number" ? fields.opacity : opaque) as Alpha
  const width: Sizing = fields.width === "fixed" ? "fixed" : "hug"
  const height: Sizing = fields.height === "fixed" ? "fixed" : "hug"
  const view = { node, backdrop, flow, gap, padding, align, opacity, width, height }
  const members = frameMembers(register, node)
  if (flow === "none") return { ...view, box: origin, children: heldFree(register, made, members, origin, mode) }
  return { ...view, ...laidOut(register, made, members, origin, mode, { flow, gap, padding, align, width, height }) }
}

function layoutIn(register: Register, node: ElementId, mode: Mode): LayoutView | null {
  return memo(views[mode], register, node, () => {
    const made = frameSource(register, node)
    return made === null ? null : arranged(register, node, originOf(register, node, made, mode), mode)
  })
}

export function unsettledLayout(register: Register, node: ElementId): LayoutView | null {
  return layoutIn(register, node, "unsettled")
}

export function readLayout(register: Register, node: ElementId): LayoutView | null {
  return layoutIn(register, node, "settled")
}

export function huggedSize(register: Register, node: ElementId): Box | null {
  return frameBackdrop(register, node) === null ? null : frameSize(register, node, "settled")
}

export function layoutDepth(register: Register, node: ElementId): number {
  let depth = 0
  for (let holder = holderOf(register, node); holder !== null; holder = holderOf(register, holder)) depth += 1
  return depth
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

function sharedHolder(register: Register, nodes: readonly ElementId[]): ElementId | null | undefined {
  const parents = new Set(nodes.map((node) => groupParent(register, node)))
  const [parent] = parents
  if (parents.size !== 1 || parent === undefined) return undefined
  return parent === null || frameBackdrop(register, parent) !== null ? parent : undefined
}

function wrapped(
  register: Register,
  intent: Extract<LayoutIntent, { readonly wrap: unknown }>,
): { readonly slide: ElementGroup; readonly rows: readonly PlacedRow[] } | null {
  const holder = sharedHolder(register, intent.wrap)
  if (holder === undefined) return null
  const laid = holder === null ? null : readLayout(register, holder)
  const members: Member[] = []
  for (const node of intent.wrap) {
    const place = placeOf(register, node)
    if (place === null || shapeOf(node).slide !== intent.slide) return null
    const shown = laid?.children.find((child) => child.node === node)?.box
    if (laid !== null && shown === undefined) return null
    members.push(memberOf(node, shown === undefined ? huggedPlace(register, node, place) : { ...place, box: shown }))
  }
  if (members.length === 0 || new Set(intent.wrap).size !== intent.wrap.length) return null
  const { flow, gap, align, order } = guessed(members)
  const box = groupBounds(members)
  const opening: ElementPatch = {
    layout: { flow: { set: flow }, gap: { set: gap }, padding: { set: noPadding }, align: { set: align } },
  }
  const element: IndexElement = { node: intent.node, kind: "group", value: null, box, grouped: false, opening }
  const backdrop: IndexElement = { node: intent.backdrop, kind: "shape", value: null, box, grouped: false }
  const slide: ElementGroup = { slide: "element-group", id: intent.slide, element, members: order, backdrop }
  if (laid === null || laid.flow !== "none") return { slide, rows: [] }
  const at = { x: { set: box.x - laid.box.x }, y: { set: box.y - laid.box.y } }
  return { slide, rows: [{ node: intent.node, patch: { box: at } }] }
}

function ownBox(register: Register, node: ElementId, box: Box): Readonly<Record<string, FieldEdit<number>>> {
  const size = { w: { set: box.cx }, h: { set: box.cy } }
  const holder = holderOf(register, node)
  const above = holder === null ? null : readLayout(register, holder)
  if (above !== null && above.flow !== "none") return size
  const [x, y] = above === null ? [box.x, box.y] : [box.x - above.box.x, box.y - above.box.y]
  return { x: { set: x }, y: { set: y }, ...size }
}

function frozen(register: Register, node: ElementId): readonly PlacedRow[] | null {
  const view = readLayout(register, node)
  if (view === null || view.flow === "none") return null
  const { box } = view
  const frame: PlacedRow = { node, patch: { layout: { flow: { set: "none" } }, box: ownBox(register, node, box) } }
  const children = view.children.map((child): PlacedRow => ({
    node: child.node,
    patch: { box: { x: { set: child.box.x - box.x }, y: { set: child.box.y - box.y } } },
  }))
  return [frame, ...children]
}

export function refrozenRows(register: Register, node: ElementId): readonly PlacedRow[] {
  const made = frameSource(register, node)
  if (made === null || frameNow(register, node) !== "free") return []
  const origin = originOf(register, node, made, "settled")
  return frameMembers(register, node).flatMap((member): PlacedRow[] => {
    const sides = traitNow(register, member.node, "box")
    const box: Record<string, FieldEdit<number>> = {}
    if (typeof sides.x === "number") box.x = { set: sides.x - origin.x }
    if (typeof sides.y === "number") box.y = { set: sides.y - origin.y }
    return Object.keys(box).length === 0 ? [] : [{ node: member.node, patch: { box } }]
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
  | { readonly slide: ElementGroup; readonly rows: readonly PlacedRow[] }
  | { readonly rows: readonly PlacedRow[] }
  | { readonly turn: readonly Command[] }
  | null {
  if ("wrap" in intent) return wrapped(register, intent)
  if ("move" in intent) {
    const now = spotNow(register, intent.move)
    const inPlain = now?.frame !== null && now?.frame !== undefined && plainGroup(register, now.frame)
    const box =
      now === null ? null : intent.frame === null || inPlain ? now.box : (placeOf(register, intent.move)?.box ?? null)
    const spot = box === null ? null : { frame: intent.frame, before: intent.before ?? null, box }
    const turn = spot === null ? null : joinTurn(register, intent.file, intent.move, spot)
    return turn === null ? null : { turn }
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

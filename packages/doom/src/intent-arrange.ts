import { orderKeyBetween, type OrderKey } from "./order-key.js"
import type { Intent } from "./intent-read.js"
import { type Draft, Stop, add, fitKind, keysAfter, living, onwards, put, stop } from "./intent-draft.js"
import { compileSet } from "./intent-set.js"
import { moveSlides, removeSlide } from "./intent-slide.js"
import { moveToSlide, slidePlace } from "./move-to-slide.js"
import { isRefusal } from "./refusal.js"
import { sidesOf } from "./intent-look.js"
import { gapFor, slideSize } from "./intent-place.js"
import type { NodeId } from "./ids.js"
import type { Layout } from "./layout.js"
import type { Node } from "./doom.js"
import { boxOf, childrenOf, descendantsOf, isLaidOut, parentOf, propOf, slideOf, zeroBox } from "./doom-walk.js"
import type { End } from "./geometry.js"
import { measureWith } from "./measure.js"
import {
  type Matrix,
  apply,
  boxMatrix,
  contentMatrix,
  fitShift,
  identity,
  invert,
  multiply,
  unfittedBox,
} from "./matrix.js"
import { wrapRotation } from "./angle.js"
import { boundsOf, cornersOf, placeBoxes } from "./place-slide.js"
import type { Box, LayoutBox, Point } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"

type Op<K extends Intent["op"]> = Extract<Intent, { op: K }>
type Boxes = ReadonlyMap<NodeId, LayoutBox> | undefined

const arrangeable = (node: Node) => node.type === "frame" || node.type === "shape"

const solvedOf = (node: Node, boxes: Boxes): LayoutBox | undefined => boxes?.get(node.id) ?? propOf(node, "box")

const keptBox = (node: Node, solved: LayoutBox, baked: boolean): Box =>
  (baked ? undefined : propOf(node, "box")) ?? unfittedBox(solved)

function freeEnds(draft: Draft, node: Node, move: (end: Point) => Point): boolean {
  const line = propOf(node, "geometry")
  if (line?.kind !== "line") return false
  const carry = (end: End): End => ("node" in end ? end : move(end))
  put(draft, node.id, { geometry: { ...line, start: carry(line.start), end: carry(line.end) } })
  return true
}

function carry(draft: Draft, node: Node, boxes: Boxes, across: Matrix, turn: number, baked: boolean): void {
  const rounded = (at: Point) => {
    const spot = apply(across, at)
    return { x: Math.round(spot.x), y: Math.round(spot.y) }
  }
  if (freeEnds(draft, node, rounded)) return
  const solved = solvedOf(node, boxes)
  if (solved === undefined) return
  const { w, h, fit } = solved
  const centre = apply(across, { x: solved.x + w / 2, y: solved.y + h / 2 })
  const rotation = wrapRotation(solved.rotation + turn)
  const shift = fitShift({ w, h, rotation }, fit)
  put(draft, node.id, {
    box: {
      ...keptBox(node, solved, baked),
      x: Math.round(centre.x - w / 2 - shift.x),
      y: Math.round(centre.y - h / 2 - shift.y),
      rotation,
    },
  })
}

function holderOf(draft: Draft, boxes: Boxes, id: NodeId): { readonly content: Matrix; readonly rotation: number } {
  const node = draft.doom.nodes.get(id)
  const slide = slideOf(draft.doom, id)
  if (node?.type === "slide" || slide === undefined) return { content: identity, rotation: 0 }
  return placeBoxes(draft.doom, slide, boxes ?? new Map()).get(id) ?? { content: identity, rotation: 0 }
}

function parentIdOf(node: Node): NodeId {
  return parentOf(node)?.id ?? stop("missing", node.id)
}

function arrangeableNode(draft: Draft, id: NodeId, field: string): Node {
  const node = living(draft, id, field)
  return arrangeable(node) ? node : stop("shape", id, field, "form", { code: "layer" })
}

function sourceBoxes(draft: Draft, ids: readonly NodeId[]): ReadonlyMap<NodeId, Box> | undefined {
  if (draft.reading.boxes !== undefined) return draft.reading.boxes
  const measure = draft.reading.measure ?? measureWith({})
  const slides = new Set<NodeId>()
  for (const id of ids) {
    const slide = slideOf(draft.doom, id)
    if (slide !== undefined) slides.add(slide)
  }
  const solved = new Map<NodeId, Box>()
  for (const slide of slides) for (const [id, box] of solveLayout(draft.doom, slide, measure)) solved.set(id, box)
  return solved.size === 0 ? undefined : solved
}

function placeOnSlide(
  draft: Draft,
  ids: readonly NodeId[],
  into: NodeId | undefined,
  after: NodeId | null | undefined,
  box: Op<"move">["box"],
): void {
  if (into === undefined) stop("shape", undefined, "parent", "needs", { code: "destination-slide" })
  const boxes = sourceBoxes(draft, ids)
  const kept = slidePlace(draft.doom, ids, boxes)
  if (isRefusal(kept)) throw new Stop(kept)
  const place = { x: box?.x ?? kept.x, y: box?.y ?? kept.y }
  const moved = moveToSlide(draft.doom, ids, into, place, {
    ...(boxes === undefined ? {} : { boxes }),
    ...(after === undefined ? {} : { after }),
  })
  if (isRefusal(moved)) throw new Stop(moved)
  draft.writes.push(...moved.writes)
}

function reparent(draft: Draft, node: Node, into: NodeId | undefined, after: NodeId | null | undefined): void {
  const from = parentIdOf(node)
  const target = living(draft, into ?? from, "parent")
  if (target.type !== "slide" && target.type !== "frame")
    stop("shape", target.id, "parent", "form", { code: "slide-or-frame" })
  if (target.id === node.id || descendantsOf(draft.doom, node.id).some((inside) => inside.id === target.id))
    stop("cycle", node.id, "parent")
  const previous =
    after === undefined
      ? (childrenOf(draft.doom, target.id)
          .filter((sibling) => sibling.id !== node.id)
          .at(-1)?.id ?? null)
      : after
  if (previous === node.id) stop("shape", node.id, "after", "form", { code: "after-sibling" })
  const [key] = keysAfter(draft, target.id, previous, 1, new Set([node.id]))
  draft.writes.push({ node: node.id, prop: "parent", value: { id: target.id, at: key as OrderKey } })
  if (target.id === from) return
  const boxes = sourceBoxes(draft, [node.id, target.id])
  const was = holderOf(draft, boxes, from)
  const now = holderOf(draft, boxes, target.id)
  const leaving = draft.doom.nodes.get(from)
  const baked = leaving !== undefined && isLaidOut(leaving)
  carry(draft, node, boxes, multiply(invert(now.content), was.content), was.rotation - now.rotation, baked)
}

function afterOf(draft: Draft, into: NodeId, moving: readonly NodeId[], before: NodeId): NodeId | null {
  const siblings = childrenOf(draft.doom, into).filter((sibling) => !moving.includes(sibling.id))
  const at = siblings.findIndex((sibling) => sibling.id === before)
  if (at < 0) stop("missing", before, "before")
  return siblings[at - 1]?.id ?? null
}

export function compileMove(draft: Draft, intent: Op<"move">): void {
  const targets = intent.targets.map((id) => living(draft, id, "targets"))
  const first = targets[0] as Node
  if (targets.some((node) => node.type === "slide" || node.type === "slideRow")) {
    if (intent.parent !== undefined) stop("shape", first.id, "parent", "unknown")
    if (intent.box !== undefined) stop("shape", first.id, "box", "unknown")
    return moveSlides(draft, targets, intent)
  }
  if (intent.group !== undefined) stop("shape", first.id, "group", "unknown")
  const ids = targets.map((node) => arrangeableNode(draft, node.id, "targets").id)
  const placed = ids.length > 1 || intent.box !== undefined
  const into = intent.parent ?? (placed ? slideOf(draft.doom, first.id) : undefined)
  const after =
    intent.before === undefined ? intent.after : afterOf(draft, into ?? parentIdOf(first), ids, intent.before)
  if (placed) placeOnSlide(draft, ids, into, after, intent.box)
  else reparent(draft, first, into, after)
}

function wrap(
  draft: Draft,
  targets: readonly NodeId[],
  wrapLayout: Op<"group">["layout"],
  clip: boolean | undefined,
): NodeId {
  const nodes = [...new Set(targets)].map((id) => arrangeableNode(draft, id, "targets"))
  const parent = parentIdOf(nodes[0] as Node)
  for (const node of nodes)
    if (parentIdOf(node) !== parent) stop("shape", node.id, "targets", "form", { code: "same-parent" })
  const position = new Map(childrenOf(draft.doom, parent).map((child, at) => [child.id, at]))
  const ordered = [...nodes].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
  const boxes = sourceBoxes(draft, [parent])
  const points = ordered.flatMap((node) => {
    const line = propOf(node, "geometry")
    const ends = line?.kind === "line" ? [line.start, line.end].flatMap((end) => ("node" in end ? [] : [end])) : []
    const solved = line?.kind === "line" && ends.length > 0 ? boxes?.get(node.id) : solvedOf(node, boxes)
    return [...ends, ...(solved === undefined ? [] : cornersOf(boxMatrix(identity, solved), solved))]
  })
  const bounds = boundsOf(points)
  const origin = { x: Math.round(bounds.left), y: Math.round(bounds.top) }
  const size = {
    w: Math.max(1, Math.round(bounds.right - bounds.left)),
    h: Math.max(1, Math.round(bounds.bottom - bounds.top)),
  }
  const layout: Layout | undefined =
    wrapLayout === "row" || wrapLayout === "column"
      ? {
          mode: wrapLayout,
          gap: gapFor(slideSize(draft).w, draft.placement),
          padding: sidesOf(0),
          align: "top-left",
        }
      : undefined
  const frame = draft.mint()
  add(
    draft,
    frame,
    "frame",
    parent,
    {
      box: { ...zeroBox, ...origin, ...size },
      ...(clip === true && layout === undefined ? {} : { sizing: { w: "hug" as const, h: "hug" as const } }),
      ...(layout === undefined ? {} : { layout }),
      ...(clip === true ? { clip: true } : {}),
    },
    parentOf(ordered.at(-1) as Node)?.at as OrderKey,
  )
  const holder = draft.doom.nodes.get(parent)
  const baked = holder !== undefined && isLaidOut(holder)
  let before: OrderKey | null = null
  for (const node of ordered) {
    before = orderKeyBetween(before, null)
    draft.writes.push({ node: node.id, prop: "parent", value: { id: frame, at: before } })
    if (freeEnds(draft, node, (end) => ({ x: end.x - origin.x, y: end.y - origin.y }))) continue
    const solved = solvedOf(node, boxes)
    if (solved === undefined) continue
    const spot = unfittedBox(solved)
    put(draft, node.id, {
      box: { ...keptBox(node, solved, baked), x: Math.round(spot.x - origin.x), y: Math.round(spot.y - origin.y) },
    })
  }
  return frame
}

export function compileGroup(draft: Draft, intent: Op<"group">): void {
  const { op: _op, targets, layout, clip, ...look } = intent
  fitKind("update", "frame", look)
  const frame = wrap(draft, targets, layout, clip)
  if (Object.values(look).some((value) => value !== undefined))
    compileSet(onwards(draft), { ...look, op: "update", target: frame })
}

export function compileUngroup(draft: Draft, intent: Op<"ungroup">): void {
  const frame = living(draft, intent.target, "target")
  if (frame.type !== "frame") stop("shape", frame.id, "target", "form", { code: "frame" })
  const parent = parentIdOf(frame)
  const kids = childrenOf(draft.doom, frame.id)
  const keys = keysAfter(draft, parent, frame.id, kids.length)
  const boxes = sourceBoxes(draft, [frame.id])
  const placed = boxOf(frame, boxes)
  const across = contentMatrix(boxMatrix(identity, placed), placed)
  kids.forEach((kid, at) => {
    draft.writes.push({ node: kid.id, prop: "parent", value: { id: parent, at: keys[at] as OrderKey } })
    carry(draft, kid, boxes, across, placed.rotation, isLaidOut(frame))
  })
  draft.writes.push({ node: frame.id, prop: "parent", value: null })
}

export function compileRemove(draft: Draft, intent: Op<"remove">): void {
  for (const id of new Set(intent.targets)) {
    if (living(draft, id, "targets").type === "slide") removeSlide(draft, id)
    else draft.writes.push({ node: arrangeableNode(draft, id, "targets").id, prop: "parent", value: null })
  }
}

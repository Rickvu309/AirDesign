import { orderKeyBetween, type OrderKey } from "./order-key.js"
import type { Intent } from "./intent-read.js"
import { type Draft, Stop, add, keysAfter, living, put, stop } from "./intent-draft.js"
import { moveToSlide, slidePlace } from "./move-to-slide.js"
import { isRefusal } from "./refusal.js"
import { sidesOf } from "./intent-look.js"
import { gapFor, slideSize } from "./intent-place.js"
import type { NodeId } from "./ids.js"
import type { Layout } from "./layout.js"
import type { Node } from "./doom.js"
import { boxOf, childrenOf, descendantsOf, parentOf, propOf, slideOf, zeroBox } from "./doom-walk.js"
import { measureWith } from "./measure.js"
import { unfittedBox } from "./matrix.js"
import type { Box } from "./resolved.js"
import { solveLayout } from "./solve-layout.js"

type Op<K extends Intent["op"]> = Extract<Intent, { op: K }>

const arrangeable = (node: Node) => node.type === "frame" || node.type === "shape"

const hasBox = (draft: Draft, node: Node) =>
  propOf(node, "box") !== undefined || draft.reading.boxes?.has(node.id) === true

function shift(draft: Draft, node: Node, dx: number, dy: number): void {
  if (!hasBox(draft, node) || (dx === 0 && dy === 0)) return
  const box = unfittedBox(boxOf(node, draft.reading.boxes))
  put(draft, node.id, { box: { ...box, x: box.x + dx, y: box.y + dy } })
}

function originIn(draft: Draft, parent: NodeId): { readonly x: number; readonly y: number } {
  let x = 0
  let y = 0
  let at: Node | undefined = draft.doom.nodes.get(parent)
  for (let hops = 0; at?.type === "frame" && hops <= draft.doom.nodes.size; hops += 1) {
    const box = unfittedBox(boxOf(at, draft.reading.boxes))
    x += box.x
    y += box.y
    const above = parentOf(at)
    at = above == null ? undefined : draft.doom.nodes.get(above.id)
  }
  return { x, y }
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

function placeOnSlide(draft: Draft, intent: Op<"move">): void {
  if (intent.node !== undefined && intent.nodes !== undefined)
    stop("shape", intent.node, "nodes", "form", { code: "layer-or-layers" })
  const ids = intent.nodes ?? (intent.node === undefined ? undefined : [intent.node])
  if (ids === undefined) stop("shape", undefined, "node", "needs", { code: "layer" })
  if (intent.into === undefined) stop("shape", undefined, "into", "needs", { code: "destination-slide" })
  const boxes = sourceBoxes(draft, ids)
  const kept = slidePlace(draft.doom, ids, boxes)
  if (isRefusal(kept)) throw new Stop(kept)
  const place = { x: intent.box?.x ?? kept.x, y: intent.box?.y ?? kept.y }
  const moved = moveToSlide(draft.doom, ids, intent.into, place, {
    ...(boxes === undefined ? {} : { boxes }),
    ...(intent.after === undefined ? {} : { after: intent.after }),
  })
  if (isRefusal(moved)) throw new Stop(moved)
  draft.writes.push(...moved.writes)
}

export function compileMove(draft: Draft, intent: Op<"move">): void {
  if (intent.nodes !== undefined || intent.box !== undefined) {
    placeOnSlide(draft, intent)
    return
  }
  if (intent.node === undefined) stop("shape", undefined, "node", "needs", { code: "layer" })
  const node = arrangeableNode(draft, intent.node, "node")
  const from = parentIdOf(node)
  const target = intent.into === undefined ? living(draft, from, "into") : living(draft, intent.into, "into")
  if (target.type !== "slide" && target.type !== "frame")
    stop("shape", target.id, "into", "form", { code: "slide-or-frame" })
  if (target.id === node.id || descendantsOf(draft.doom, node.id).some((inside) => inside.id === target.id))
    stop("cycle", node.id, "into")
  const previous =
    intent.after === undefined
      ? (childrenOf(draft.doom, target.id)
          .filter((sibling) => sibling.id !== node.id)
          .at(-1)?.id ?? null)
      : intent.after
  if (previous === node.id) stop("shape", node.id, "after", "form", { code: "after-sibling" })
  const [key] = keysAfter(draft, target.id, previous, 1, new Set([node.id]))
  draft.writes.push({ node: node.id, prop: "parent", value: { id: target.id, at: key as OrderKey } })
  if (target.id === from) return
  const before = originIn(draft, from)
  const after = originIn(draft, target.id)
  shift(draft, node, before.x - after.x, before.y - after.y)
}

export function compileWrap(draft: Draft, intent: Op<"wrap">): void {
  const nodes = [...new Set(intent.nodes)].map((id) => arrangeableNode(draft, id, "nodes"))
  const parent = parentIdOf(nodes[0] as Node)
  for (const node of nodes)
    if (parentIdOf(node) !== parent) stop("shape", node.id, "nodes", "form", { code: "same-parent" })
  const position = new Map(childrenOf(draft.doom, parent).map((child, at) => [child.id, at]))
  const ordered = [...nodes].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
  const boxes = ordered.map((node) => boxOf(node, draft.reading.boxes))
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.w))
  const bottom = Math.max(...boxes.map((box) => box.y + box.h))
  const layout: Layout | undefined =
    intent.layout === "row" || intent.layout === "column"
      ? {
          mode: intent.layout,
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
      box: { ...zeroBox, x: left, y: top, w: right - left, h: bottom - top },
      ...(intent.clip === true && layout === undefined ? {} : { sizing: { w: "hug" as const, h: "hug" as const } }),
      ...(layout === undefined ? {} : { layout }),
      ...(intent.clip === true ? { clip: true } : {}),
    },
    parentOf(ordered[0] as Node)?.at as OrderKey,
  )
  let before: OrderKey | null = null
  for (const node of ordered) {
    before = orderKeyBetween(before, null)
    draft.writes.push({ node: node.id, prop: "parent", value: { id: frame, at: before } })
    shift(draft, node, -left, -top)
  }
}

export function compileUnwrap(draft: Draft, intent: Op<"unwrap">): void {
  const frame = living(draft, intent.node, "node")
  if (frame.type !== "frame") stop("shape", frame.id, "node", "form", { code: "frame" })
  const parent = parentIdOf(frame)
  const kids = childrenOf(draft.doom, frame.id)
  const keys = keysAfter(draft, parent, frame.id, kids.length)
  const origin = unfittedBox(boxOf(frame, draft.reading.boxes))
  kids.forEach((kid, at) => {
    draft.writes.push({ node: kid.id, prop: "parent", value: { id: parent, at: keys[at] as OrderKey } })
    shift(draft, kid, origin.x, origin.y)
  })
  draft.writes.push({ node: frame.id, prop: "parent", value: null })
}

export function compileDelete(draft: Draft, intent: Op<"delete">): void {
  const nodes = [...new Set(intent.nodes)].map((id) => arrangeableNode(draft, id, "nodes").id)
  for (const id of nodes) draft.writes.push({ node: id, prop: "parent", value: null })
}

import type { OrderKey } from "../order-key.js"
import type { AgentChange, SlideAdd, SlideMove } from "./agent-change.js"
import { type Draft, add, keysAfter, living, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Node } from "./scene.js"
import { deckOf, parentOf, rowsOf, slidesOf } from "./scene-walk.js"

function deckSlide(draft: Draft, id: NodeId, field: string): Node {
  const node = living(draft, id, field)
  return node.type === "slide" && slidesOf(draft.scene).some((slide) => slide.id === id)
    ? node
    : stop("shape", id, field)
}

function addSlide(draft: Draft, options: SlideAdd): void {
  const deck = deckOf(draft.scene) ?? stop("missing")
  const slides = slidesOf(draft.scene)
  const previous = options.after === undefined ? slides.at(-1) : deckSlide(draft, options.after, "after")
  let row = previous === undefined ? rowsOf(draft.scene, false).at(-1)?.id : parentOf(previous)?.id
  if (row === undefined) {
    row = draft.mint()
    add(draft, row, "slideRow", deck.id, {})
  }
  const [key] = keysAfter(draft, row, previous?.id ?? null, 1)
  add(draft, draft.mint(), "slide", row, { name: `Slide ${slides.length + 1}` }, key as OrderKey)
}

function moveSlide(draft: Draft, options: SlideMove): void {
  const slide = deckSlide(draft, options.slide, "move")
  const after = options.after === null ? null : deckSlide(draft, options.after, "after")
  if (after?.id === slide.id) stop("shape", slide.id, "after")
  const row = after === null ? rowsOf(draft.scene, false)[0]?.id : parentOf(after)?.id
  if (row === undefined) stop("missing", undefined, "after")
  const [key] = keysAfter(draft, row, after?.id ?? null, 1, new Set([slide.id]))
  draft.writes.push({ node: slide.id, prop: "parent", value: { id: row, at: key as OrderKey } })
}

export function compileSlide(draft: Draft, change: Extract<AgentChange, { op: "slide" }>): void {
  const given = [change.add, change.move, change.delete].filter((part) => part !== undefined)
  if (given.length !== 1) stop("shape", undefined, "slide")
  if (change.add !== undefined) return addSlide(draft, change.add)
  if (change.move !== undefined) return moveSlide(draft, change.move)
  if (change.delete !== undefined)
    draft.writes.push({ node: deckSlide(draft, change.delete, "delete").id, prop: "parent", value: null })
}

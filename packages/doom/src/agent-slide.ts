import type { OrderKey } from "./order-key.js"
import type { AgentChange, SlideAdd, SlideMove } from "./agent-change.js"
import { type Draft, add, keysAfter, living, stop } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import type { Node } from "./doom.js"
import { deckOf, parentOf, slideRowAt, slidesOf } from "./doom-walk.js"

function deckSlide(draft: Draft, id: NodeId, field: string): Node {
  const node = living(draft, id, field)
  return node.type === "slide" && slidesOf(draft.doom).some((slide) => slide.id === id)
    ? node
    : stop("shape", id, field, "form", "A slide id.")
}

function addSlide(draft: Draft, options: SlideAdd): void {
  const deck = deckOf(draft.doom) ?? stop("missing")
  const slides = slidesOf(draft.doom)
  const previous = options.after === undefined ? slides.at(-1) : deckSlide(draft, options.after, "after")
  let row = previous === undefined ? slideRowAt(draft.doom, "last") : parentOf(previous)?.id
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
  if (after?.id === slide.id) stop("shape", slide.id, "after", "form", "A different slide, or null to put it first.")
  const row = after === null ? slideRowAt(draft.doom, "first") : parentOf(after)?.id
  if (row === undefined) stop("missing", undefined, "after")
  const [key] = keysAfter(draft, row, after?.id ?? null, 1, new Set([slide.id]))
  draft.writes.push({ node: slide.id, prop: "parent", value: { id: row, at: key as OrderKey } })
}

export function compileSlide(draft: Draft, change: Extract<AgentChange, { op: "slide" }>): void {
  const given = [change.add, change.move, change.delete].filter((part) => part !== undefined)
  if (given.length !== 1) stop("shape", undefined, "slide", "form", "Exactly one of add, move or delete.")
  if (change.add !== undefined) return addSlide(draft, change.add)
  if (change.move !== undefined) return moveSlide(draft, change.move)
  if (change.delete !== undefined)
    draft.writes.push({ node: deckSlide(draft, change.delete, "delete").id, prop: "parent", value: null })
}

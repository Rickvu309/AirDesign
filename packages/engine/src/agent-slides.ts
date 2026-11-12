import { slideReaders, type SlideOp, type CallRefusal } from "@airdesign/catalog"
import {
  decide,
  floorFor,
  floorNodes,
  openingElement,
  foldSlides,
  nextSlideId,
  orderKeyBetween,
  orderKeyAfter,
  presentSlides,
  readSlideId,
  shapeOf,
  currentValue,
  currentBox,
  type SlideCommand,
  type IndexElement,
} from "@airdesign/document"
import type { Caller, Deck } from "./call.js"

type Built =
  | { readonly ok: true; readonly register: Deck["register"] }
  | { readonly ok: false; readonly refusal: CallRefusal }
export function agentSlide(op: SlideOp, deck: Deck, caller: Caller, raw: unknown): Built {
  if (caller.actor !== "agent") return { ok: false, refusal: "field" }
  const parsed = slideReaders[op](raw)
  if (!parsed.ok) return parsed
  if (parsed.deck !== deck.id) return { ok: false, refusal: "deck" }
  if (parsed.base !== deck.revision) return { ok: false, refusal: "stale" }
  const register = deck.register
  const index = register.index
  if (index === undefined || index.elements.length !== index.total) return { ok: false, refusal: "dead" }
  const file = index.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const state = { file, order: register.order }
  const spots = presentSlides(state)
  const id = nextSlideId(foldSlides(state).map((row) => row.id))
  let edit: SlideCommand
  if ("layout" in parsed) {
    const key = orderKeyAfter(spots, parsed.after)
    const layoutSpot = spots.find((row) => row.id === parsed.layout)
    if (key === null || layoutSpot === undefined) return { ok: false, refusal: "dead" }
    let layout = parsed.layout
    for (let count = 0; count <= register.order.length; count += 1) {
      const birth = foldSlides(state).find((row) => row.id === layout)?.birth
      if (birth?.from === "blank") layout = birth.layout
      else if (birth?.from === "clone") layout = birth.source
      else break
    }
    const floor = index.slides.find((row) => row.id === layout)?.layout
    if (floor === undefined) return { ok: false, refusal: "dead" }
    edit = { slide: "add", id, after: parsed.after, key, layout: parsed.layout, floor: floorFor(floor, id) }
  } else if ("after" in parsed) {
    const remaining = spots.filter((row) => row.id !== parsed.slide)
    const after = readSlideId(parsed.after)
    const key =
      parsed.after === null
        ? orderKeyBetween(null, remaining[0]?.key ?? null)
        : after === undefined
          ? null
          : orderKeyAfter(remaining, after)
    if (key === null) return { ok: false, refusal: "dead" }
    edit = { slide: "move", id: parsed.slide, key }
  } else if (op === "delete_slide") {
    edit = { slide: "remove", id: parsed.slide }
  } else {
    const key = orderKeyAfter(spots, parsed.slide)
    if (key === null) return { ok: false, refusal: "dead" }
    const rows: IndexElement[] = [...index.elements]
    for (const node of floorNodes(register)) {
      const row = openingElement(register, node)
      if (row !== undefined) rows.push(row)
    }
    const floor = rows
      .filter((row) => shapeOf(row.node).slide === parsed.slide)
      .map((row) => {
        const body = register.elements[row.node]
        return body === undefined ? row : { ...row, value: currentValue(body), box: currentBox(body) ?? row.box }
      })
    edit = { slide: "clone", id, source: parsed.slide, key, floor: floorFor(floor, id) }
  }
  const result = decide(register, { command: "slide", file, edit: { ...edit, runId: caller.runId } })
  return result.decision === "refuse" ? { ok: false, refusal: result.code } : { ok: true, register: result.register }
}

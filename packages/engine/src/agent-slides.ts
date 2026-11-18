import type { CallRefusal, WireSlideChange } from "@airdesign/catalog"
import {
  cloneMany,
  decide,
  elementGone,
  floorFor,
  floorOpening,
  landedPatch,
  floorNodes,
  openingElement,
  foldSlides,
  gridCommandVersion,
  nextSlideId,
  presentSlides,
  readSlideId,
  shapeOf,
  ownFloor,
  slideKind,
  storedElements,
  currentValue,
  currentBox,
  type DeckIndex,
  type IndexElement,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import type { Deck } from "./call.js"

type Built =
  | { readonly ok: true; readonly register: Deck["register"]; readonly runId: string }
  | { readonly ok: false; readonly refusal: CallRefusal }
function heldBy(register: Register, runId: string) {
  const held = [...new Set([...register.nodes, ...storedElements(register)])].flatMap((node) => {
    const body = register.elements[node]
    const holds = body !== undefined && (body.runId === runId || body.landed.some((row) => row.runId === runId))
    return holds ? [{ node, body }] : []
  })
  return { held, live: held.filter(({ body }) => body.phase === "running" && body.runId === runId) }
}

export function runFenced(register: Register, runId: string): boolean {
  if (register.ended?.includes(runId) === true) return true
  const { held, live } = heldBy(register, runId)
  return held.length > 0 && live.length === 0
}

export function runFence(register: Register, runId: string, deleted: readonly string[]): CallRefusal | null {
  if (runFenced(register, runId)) return "run-fenced"
  const protectedHere = heldBy(register, runId).live.some(
    ({ node, body }) => body.guarded && node.includes(".") && deleted.includes(shapeOf(node).slide),
  )
  return protectedHere ? "person-protected" : null
}

function openingRows(register: Deck["register"], index: DeckIndex, slide: SlideId): readonly IndexElement[] {
  const rows: IndexElement[] = [...index.elements]
  for (const node of floorNodes(register)) {
    const row = openingElement(register, node)
    if (row !== undefined) rows.push(row)
  }
  return rows.filter((row) => shapeOf(row.node).slide === slide)
}

function cloneFloor(register: Register, index: DeckIndex, source: SlideId, id: SlideId): readonly IndexElement[] {
  const floor = openingRows(register, index, source)
    .filter((row) => !elementGone(register, row.node) && slideKind(row.node) !== "slide")
    .map((row) => {
      const body = register.elements[row.node]
      const opening = floorOpening(register, row.node, body === undefined ? {} : landedPatch(body, "text"))
      const shown = body === undefined ? row : { ...row, value: currentValue(body), box: currentBox(body) ?? row.box }
      return opening === undefined ? shown : { ...shown, opening }
    })
  return floorFor([...floor, ownFloor(register, source)], id)
}

export function readFresh(deck: Deck, runId: string, base: number): boolean {
  if (base === deck.revision) return true
  const last = deck.register.lastRun
  return last?.runId === runId && last.revision === deck.revision && last.since <= base && base < deck.revision
}

export function agentSlide(deck: Deck, parsed: WireSlideChange, runId: string, base: number): Built {
  if (!readFresh(deck, runId, base)) return { ok: false, refusal: "stale" }
  const register = deck.register
  const deleted = parsed.op === "delete_slide" ? [parsed.slide] : parsed.op === "delete_slides" ? parsed.slides : []
  const fenced = runFence(register, runId, deleted)
  if (fenced !== null) return { ok: false, refusal: fenced }
  const index = register.index
  if (index === undefined || index.elements.length !== index.total) return { ok: false, refusal: "indexing" }
  const file = index.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const state = { ...register, file }
  const grid = gridCommandVersion(state)
  const spots = presentSlides(state)
  const id = nextSlideId(foldSlides(state).map((row) => row.id))
  let edit: SlideCommand
  if (parsed.op === "add_slide") {
    const layoutSpot = spots.find((row) => row.id === parsed.layout)
    if (!spots.some((spot) => spot.id === parsed.after) || layoutSpot === undefined)
      return { ok: false, refusal: "dead" }
    let layout = parsed.layout
    let floor: readonly IndexElement[] | undefined
    for (let count = 0; count <= register.order.length; count += 1) {
      const birth = foldSlides(state).find((row) => row.id === layout)?.birth
      if (birth?.from === "blank" && birth.layoutPart !== undefined) {
        floor = openingRows(register, index, layout)
        break
      }
      if (birth?.from === "blank") layout = birth.layout
      else if (birth?.from === "clone") layout = birth.source
      else break
    }
    floor ??= index.slides.find((row) => row.id === layout)?.layout
    if (floor === undefined) return { ok: false, refusal: "dead" }
    edit = {
      slide: "add",
      id,
      after: parsed.after,
      grid,
      row: parsed.row ?? "same",
      layout: parsed.layout,
      floor: floorFor(floor, id),
    }
  } else if (parsed.op === "move_slides") {
    edit = { slide: "move-many", ids: parsed.slides, after: parsed.after, grid, row: parsed.row }
  } else if (parsed.op === "move_slide") {
    edit = { slide: "move", id: parsed.slide, after: parsed.after, grid, row: "same" }
  } else if (parsed.op === "delete_slide") {
    edit = { slide: "remove", id: parsed.slide, grid }
  } else if (parsed.op === "delete_slides") {
    edit = { slide: "remove-many", ids: parsed.slides, grid }
  } else if (parsed.op === "duplicate_slides") {
    const copied = cloneMany(state, parsed.slides, (source, id) => cloneFloor(register, index, source, id))
    if (copied === null) return { ok: false, refusal: "dead" }
    edit = copied
  } else if (parsed.op === "duplicate_slide") {
    if (!spots.some((spot) => spot.id === parsed.slide)) return { ok: false, refusal: "dead" }
    edit = {
      slide: "clone",
      id,
      source: parsed.slide,
      grid,
      floor: cloneFloor(register, index, parsed.slide, id),
    }
  } else return { ok: false, refusal: "field" }
  const result = decide(register, { command: "slide", file, edit: { ...edit, runId } })
  if (result.decision === "refuse") return { ok: false, refusal: result.code }
  return { ok: true, register: result.register, runId }
}

import { elementReaders, type ElementOp, type CallRefusal } from "@airdesign/catalog"
import {
  currentBox,
  decide,
  elementGone,
  floorNodes,
  nextElementId,
  openingElement,
  placeNewBox,
  presentSlides,
  readSlideId,
  shapeOf,
  slideMeasure,
  type Box,
  type ElementId,
  type IndexElement,
  type Register,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { readFresh, runFence } from "./agent-slides.js"
import type { Caller, Deck } from "./call.js"

type Built =
  | { readonly ok: true; readonly register: Register; readonly runId: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

function takenBoxes(register: Register, slide: SlideId): readonly Box[] {
  const rows = new Map<ElementId, IndexElement>()
  for (const row of register.index?.elements ?? []) rows.set(row.node, row)
  for (const node of floorNodes(register)) {
    const row = openingElement(register, node)
    if (row !== undefined) rows.set(node, row)
  }
  const boxes: Box[] = []
  for (const row of rows.values()) {
    if (shapeOf(row.node).slide !== slide || elementGone(register, row.node)) continue
    const body = register.elements[row.node]
    const box = (body === undefined ? null : currentBox(body)) ?? row.box
    if (box !== null) boxes.push(box)
  }
  for (const row of register.index?.slides.find((each) => each.id === slide)?.layout ?? []) {
    if (row.box !== null) boxes.push(row.box)
  }
  return boxes
}

function addedByRun(register: Register, node: ElementId, runId: string): boolean {
  return register.order.some((row) => row.slide === "element-add" && row.element.node === node && row.runId === runId)
}

function personTyped(register: Register, node: ElementId): boolean {
  return register.elements[node]?.landed.some((row) => row.actor === "person" && row.visible) === true
}

function protectedFrom(register: Register, node: ElementId, runId: string): CallRefusal | null {
  if (addedByRun(register, node, runId) && personTyped(register, node)) return "person-protected"
  const body = register.elements[node]
  if (body === undefined || body.phase !== "running") return null
  if (body.runId !== runId) return "run-fenced"
  return body.guarded ? "person-protected" : null
}

type Head = { readonly deck: string; readonly base: number }

export function ready(
  head: Head,
  deck: Deck,
  slide: SlideId | undefined,
  runId: string,
): { readonly file: readonly SlideId[] } | { readonly refusal: CallRefusal } {
  if (head.deck !== deck.id) return { refusal: "deck" }
  if (!readFresh(deck, runId, head.base)) return { refusal: "stale" }
  const fenced = runFence(deck.register, runId, null)
  if (fenced !== null) return { refusal: fenced }
  const index = deck.register.index
  if (index === undefined || index.elements.length !== index.total) return { refusal: "indexing" }
  const file = index.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const present = presentSlides({ file, order: deck.register.order })
  if (slide === undefined || !present.some((spot) => spot.id === slide)) return { refusal: "dead" }
  return { file }
}

export function decided(register: Register, file: readonly SlideId[], edit: SlideCommand, runId: string): Built {
  const result = decide(register, { command: "slide", file, edit })
  return result.decision === "refuse"
    ? { ok: false, refusal: result.code }
    : { ok: true, register: result.register, runId }
}

export function agentElement(op: ElementOp, deck: Deck, caller: Caller, raw: unknown): Built {
  if (caller.actor !== "agent") return { ok: false, refusal: "field" }
  const register = deck.register
  if (op === "add_text_box") {
    const parsed = elementReaders.add_text_box(raw)
    if (!parsed.ok) return parsed
    const opened = ready(parsed, deck, parsed.slide, caller.runId)
    if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
    const measure = slideMeasure(register, parsed.slide)
    if (measure === undefined || (parsed.box === undefined && measure.size === undefined)) {
      return { ok: false, refusal: "dead" }
    }
    const box = parsed.box ?? placeNewBox(measure.size ?? { width: 0, height: 0 }, takenBoxes(register, parsed.slide))
    const node = nextElementId(register, parsed.slide, measure.free)
    const element = { node, kind: "shape", value: "", box, grouped: false } as const
    return decided(
      register,
      opened.file,
      { slide: "element-add", id: parsed.slide, element, runId: caller.runId },
      caller.runId,
    )
  }
  const parsed = elementReaders.delete_element(raw)
  if (!parsed.ok) return parsed
  const slide = readSlideId(shapeOf(parsed.node).slide)
  const opened = ready(parsed, deck, slide, caller.runId)
  if ("refusal" in opened || slide === undefined)
    return { ok: false, refusal: "refusal" in opened ? opened.refusal : "dead" }
  const refusal = protectedFrom(register, parsed.node, caller.runId)
  if (refusal !== null) return { ok: false, refusal }
  return decided(
    register,
    opened.file,
    { slide: "element-remove", id: slide, node: parsed.node, runId: caller.runId },
    caller.runId,
  )
}

import type { CallRefusal, WireDelete } from "@airdesign/catalog"
import {
  iconSideOn,
  iconTextColor,
  currentBox,
  decide,
  elementGone,
  fitNewBox,
  fittedInside,
  floorNodes,
  nextElementId,
  openingElement,
  openingTable,
  openingTableSize,
  personWrote,
  pictureSize,
  placeNewBox,
  presentSlides,
  readSlideId,
  shapeOf,
  slideMeasure,
  tableColumns,
  textOpening,
  writeTableValue,
  type Box,
  type ElementId,
  type IndexElement,
  type Media,
  type Register,
  type SlideCommand,
  type SlideId,
  type TableValue,
} from "@airdesign/document"
import { readFresh, runFence } from "./agent-slides.js"
import type { Deck } from "./call.js"

type Built =
  | { readonly ok: true; readonly register: Register; readonly runId: string }
  | { readonly ok: false; readonly refusal: CallRefusal }

export function takenBoxes(register: Register, slide: SlideId): readonly Box[] {
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
  return register.elements[node]?.landed.some(personWrote) === true
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
  const fenced = runFence(deck.register, runId, [])
  if (fenced !== null) return { refusal: fenced }
  const index = deck.register.index
  if (index === undefined || index.elements.length !== index.total) return { refusal: "indexing" }
  const file = index.slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const present = presentSlides({ ...deck.register, file })
  if (slide === undefined || !present.some((spot) => spot.id === slide)) return { refusal: "dead" }
  return { file }
}

export function decided(register: Register, file: readonly SlideId[], edit: SlideCommand, runId: string): Built {
  const result = decide(register, { command: "slide", file, edit })
  return result.decision === "refuse"
    ? { ok: false, refusal: result.code }
    : { ok: true, register: result.register, runId }
}

export function addTextBox(
  head: Head,
  deck: Deck,
  slide: SlideId,
  wanted: Box | undefined,
  runId: string,
  value = "",
): Built {
  const register = deck.register
  const opened = ready(head, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, slide)
  if (measure === undefined || (wanted === undefined && measure.size === undefined)) {
    return { ok: false, refusal: "dead" }
  }
  const box = wanted ?? placeNewBox(measure.size ?? { width: 0, height: 0 }, takenBoxes(register, slide))
  const node = nextElementId(register, slide, measure.free)
  const opening = value === "" ? { opening: textOpening(wanted === undefined ? "auto-height" : "fixed") } : {}
  const element = { node, kind: "shape", value, box, grouped: false, ...opening } as const
  return decided(register, opened.file, { slide: "element-add", id: slide, element, runId }, runId)
}

export function addTable(
  head: Head,
  deck: Deck,
  slide: SlideId,
  table: TableValue,
  wanted: Box | undefined,
  runId: string,
): Built {
  const register = deck.register
  const opened = ready(head, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, slide)
  if (measure === undefined || (wanted === undefined && measure.size === undefined)) {
    return { ok: false, refusal: "dead" }
  }
  const size = measure.size ?? { width: 0, height: 0 }
  const rows = table.rows.length
  const box = wanted ?? placeNewBox(size, takenBoxes(register, slide), openingTableSize(size.width, rows))
  const node = nextElementId(register, slide, measure.free)
  const value = writeTableValue(openingTable(rows, tableColumns(table).length))
  const element = { node, kind: "table", value, box, grouped: false } as const
  return decided(register, opened.file, { slide: "element-add", id: slide, element, runId }, runId)
}

const chartShare = 0.5

export function addChartLayer(
  head: Head,
  deck: Deck,
  slide: SlideId,
  value: string,
  wanted: Box | undefined,
  runId: string,
): Built {
  const register = deck.register
  const opened = ready(head, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, slide)
  if (measure === undefined || (wanted === undefined && measure.size === undefined)) {
    return { ok: false, refusal: "dead" }
  }
  const size = measure.size ?? { width: 0, height: 0 }
  const half = { cx: Math.round(size.width * chartShare), cy: Math.round(size.height * chartShare) }
  const box = wanted ?? placeNewBox(size, takenBoxes(register, slide), half)
  const node = nextElementId(register, slide, measure.free)
  const element = { node, kind: "chart", value, box, grouped: false } as const
  return decided(register, opened.file, { slide: "element-add", id: slide, element, runId }, runId)
}

export function addIcon(
  head: Head,
  deck: Deck,
  slide: SlideId,
  icon: string,
  wanted: Box | undefined,
  runId: string,
): Built {
  const register = deck.register
  const opened = ready(head, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, slide)
  if (measure === undefined || (wanted === undefined && measure.size === undefined)) {
    return { ok: false, refusal: "dead" }
  }
  const size = measure.size ?? { width: 0, height: 0 }
  const side = iconSideOn(register.index?.elements ?? [], slide)
  const box = wanted ?? placeNewBox(size, takenBoxes(register, slide), { cx: side, cy: side })
  const node = nextElementId(register, slide, measure.free)
  const opening = {
    fills: { p0: { set: { image: true } }, source: { set: icon }, color: { set: iconTextColor } },
  } as const
  const element = { node, kind: "shape", value: null, box, grouped: false, opening } as const
  return decided(register, opened.file, { slide: "element-add", id: slide, element, runId }, runId)
}

export function addPicture(
  head: Head,
  deck: Deck,
  slide: SlideId,
  image: { readonly media: Media; readonly width: number; readonly height: number },
  wanted: Box | undefined,
  runId: string,
): Built {
  const register = deck.register
  const opened = ready(head, deck, slide, runId)
  if ("refusal" in opened) return { ok: false, refusal: opened.refusal }
  const measure = slideMeasure(register, slide)
  if (measure === undefined || (wanted === undefined && measure.size === undefined)) {
    return { ok: false, refusal: "dead" }
  }
  const size = measure.size ?? { width: 0, height: 0 }
  const box =
    wanted === undefined
      ? fitNewBox(size, takenBoxes(register, slide), pictureSize(image, size))
      : fittedInside(wanted, image)
  const node = nextElementId(register, slide, measure.free)
  const element = { node, kind: "shape", value: null, box, grouped: false } as const
  return decided(register, opened.file, { slide: "element-add", id: slide, element, media: image.media, runId }, runId)
}

export function deleteElement(deck: Deck, change: WireDelete, runId: string, base: number): Built {
  const register = deck.register
  const slide = readSlideId(shapeOf(change.node).slide)
  const opened = ready({ deck: deck.id, base }, deck, slide, runId)
  if ("refusal" in opened || slide === undefined)
    return { ok: false, refusal: "refusal" in opened ? opened.refusal : "dead" }
  const refusal = protectedFrom(register, change.node, runId)
  if (refusal !== null) return { ok: false, refusal }
  return decided(register, opened.file, { slide: "element-remove", id: slide, node: change.node, runId }, runId)
}

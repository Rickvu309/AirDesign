import { webImage, type CallRefusal, type WireAdd, type WireRunElement, type WireSet } from "@airdesign/catalog"
import {
  decide,
  openingSlideNumber,
  limits,
  openingElement,
  planChange,
  readTableValue,
  shapeOf,
  slideKind,
  slideBirths,
  registerScope,
  templateStylesNode,
  templateStyleIndex,
  valueBytes,
  version,
  writeTableValue,
  type ElementId,
  type Media,
  type Register,
  type Row,
  type SetChange,
} from "@airdesign/document"
import { addIcon, addPicture, addTable, addTextBox } from "./agent-elements.js"
import { readFresh } from "./agent-slides.js"
import type { Deck } from "./call.js"

export type Applied =
  | { readonly ok: true; readonly register: Register }
  | { readonly ok: false; readonly refusal: CallRefusal }

function slideOwned(register: Register, node: ElementId): boolean {
  if (node === templateStylesNode) return true
  const index = templateStyleIndex(node)
  if (index !== null) return register.index?.templateStyles?.[index] !== undefined
  if (slideKind(node) === null) return false
  const slide = shapeOf(node).slide
  return (
    register.index?.slides.some((each) => each.id === slide) === true ||
    register.order.some((command) => slideBirths(command).some((birth) => birth.id === slide))
  )
}

export function openedRegister(register: Register, edit: WireRunElement): Applied {
  if (register.nodes.includes(edit.node)) return { ok: true, register }
  const index = register.index
  if (
    index !== undefined &&
    index.elements.length === index.total &&
    openingElement(register, edit.node) === undefined &&
    !slideOwned(register, edit.node)
  )
    return { ok: false, refusal: "dead" }
  const opened = decide(register, {
    command: "add",
    node: edit.node,
    floor: edit.floor ?? register.floor,
    route: register.route,
  })
  if (opened.decision === "refuse") return { ok: false, refusal: opened.code }
  return { ok: true, register: opened.register }
}

export function landRow(register: Register, node: ElementId, row: Row, runId: string): Applied {
  const bytes = valueBytes(row)
  if (bytes > limits.valueBytes) return { ok: false, refusal: "limit" }
  const opened = openedRegister(register, { node })
  if (!opened.ok) return opened
  const body = opened.register.elements[node]
  const next = opened.register.bytes + bytes
  if (body === undefined || next >= limits.bytes) return { ok: false, refusal: "limit" }
  const decision = decide(opened.register, { command: "agent", runId, readAt: version(body), node, ...row })
  if (decision.decision === "refuse") return { ok: false, refusal: decision.code }
  return { ok: true, register: { ...decision.register, bytes: next } }
}

export function applySet(register: Register, change: SetChange, runId: string): Applied {
  const planned = planChange(change, registerScope(register))
  if (!planned.ok) return { ok: false, refusal: planned.refusals[0]?.code ?? "dead" }
  let current = register
  for (const { node, row } of planned.rows) {
    const landed = landRow(current, node, row, runId)
    if (!landed.ok) return landed
    current = landed.register
  }
  return { ok: true, register: current }
}

function addedNode(register: Register): ElementId | undefined {
  const last = register.order.at(-1)
  return last?.slide === "element-add" ? last.element.node : undefined
}

type ShapeAdd = Exclude<WireAdd, { readonly kind: "line" | "arrow" | "elbow" }>

function applyTableAdd(deck: Deck, change: Extract<WireAdd, { kind: "table" }>, runId: string, base: number): Applied {
  const table = readTableValue(change.table.value)
  if (table === null) return { ok: false, refusal: "field" }
  const shaped = writeTableValue({ rows: table.rows.map((row, from) => ({ ...row, from })) })
  const added = addTable({ deck: deck.id, base }, deck, change.slide, table, change.box, runId)
  return added.ok ? withAdded(added.register, runId, { table: { value: shaped } }) : added
}

function withAdded(register: Register, runId: string, inputs: Omit<SetChange, "target">): Applied {
  const node = addedNode(register)
  if (node === undefined) return { ok: true, register }
  const opened = openedRegister(register, { node })
  if (!opened.ok) return opened
  const started = decide(opened.register, { command: "start", runId, node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  return applySet(started.register, { target: { node }, ...inputs }, runId)
}

export type PlacedImage = { readonly media: Media; readonly width: number; readonly height: number }

export type ImageLookup = (address: string) => PlacedImage | undefined

export const noImages: ImageLookup = () => undefined

function mediaRef(value: unknown, images: ImageLookup): unknown {
  if (typeof value !== "string" || !webImage(value)) return value
  const found = images(value)
  return found === undefined ? null : `${found.media.type}:${found.media.sha256}`
}

function withMedia<Change extends SetChange>(change: Change, images: ImageLookup): Change | null {
  const fills = change.fills
  if (fills === undefined || fills === null) return change
  const source = mediaRef(fills.source, images)
  const paint = fills.paint
  const image =
    typeof paint === "object" && paint !== null && "image" in paint ? mediaRef(paint.image, images) : undefined
  if (source === null || image === null) return null
  const next = {
    ...fills,
    ...(fills.source === undefined ? {} : { source }),
    ...(image === undefined ? {} : { paint: { image } }),
  }
  return { ...change, fills: next } as Change
}

function applyAdd(deck: Deck, change: ShapeAdd, runId: string, base: number, images: ImageLookup): Applied {
  if (change.kind === "table") return applyTableAdd(deck, change, runId, base)
  if ("icon" in change) return addIcon({ deck: deck.id, base }, deck, change.slide, change.icon, change.box, runId)
  if ("image" in change) {
    const image = images(change.image)
    if (image === undefined) return { ok: false, refusal: "image" }
    return addPicture({ deck: deck.id, base }, deck, change.slide, image, change.box, runId)
  }
  const value = change.text?.value
  const opening = typeof value === "string" && openingSlideNumber(value) ? value : ""
  const added = addTextBox({ deck: deck.id, base }, deck, change.slide, change.box, runId, opening)
  if (!added.ok || change.text === undefined) return added
  return withAdded(added.register, runId, { text: change.text })
}

export function applyAgentChange(
  deck: Deck,
  change: WireSet | ShapeAdd,
  runId: string,
  base: number,
  images: ImageLookup = noImages,
): Applied {
  if (!readFresh(deck, runId, base)) return { ok: false, refusal: "stale" }
  if (change.op !== "set") return applyAdd(deck, change, runId, base, images)
  const sourced = withMedia(change, images)
  return sourced === null ? { ok: false, refusal: "image" } : applySet(deck.register, sourced, runId)
}

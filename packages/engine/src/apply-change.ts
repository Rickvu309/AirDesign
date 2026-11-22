import {
  webImage,
  type CallRefusal,
  type WireAdd,
  type WireRunElement,
  type WireSet,
  type WireTemplateStyle,
} from "@airdesign/catalog"
import { applyStack } from "./agent-stack.js"
import { expandedTemplateChange } from "./apply-template.js"
import {
  decide,
  openingSlideNumber,
  limits,
  openingElement,
  planChange,
  shapeOf,
  slideKind,
  slideBirths,
  registerScope,
  templateStylesNode,
  templateStyleIndex,
  valueBytes,
  version,
  type ElementId,
  type Media,
  type PlacedChart,
  type Register,
  type Row,
  type SetChange,
} from "@airdesign/document"
import { addChartLayer, addIcon, addPicture, addTextBox } from "./agent-elements.js"
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

type TemplatedSet = Omit<SetChange, "templateStyle"> & { readonly templateStyle?: WireTemplateStyle }

function planSet(
  register: Register,
  change: TemplatedSet,
): ReturnType<typeof planChange> | { readonly ok: false; readonly refusal: CallRefusal } {
  const scope = registerScope(register)
  if (change.templateStyle?.template === undefined) return planChange(change, scope)
  const nodes = scope.expand(change.target)
  if (nodes === "indexing" || nodes.length === 0)
    return { ok: false, refusal: nodes === "indexing" ? "indexing" : "dead" }
  const rows: { readonly node: ElementId; readonly row: Row }[] = []
  for (const node of nodes) {
    const expanded = expandedTemplateChange(register, node, change)
    if (expanded === null) return { ok: false, refusal: "field" }
    const planned = planChange(expanded, scope)
    if (!planned.ok) return planned
    rows.push(...planned.rows)
  }
  return { ok: true, rows }
}

export function applySet(register: Register, change: TemplatedSet, runId: string): Applied {
  const planned = planSet(register, change)
  if (!planned.ok)
    return { ok: false, refusal: "refusal" in planned ? planned.refusal : (planned.refusals[0]?.code ?? "dead") }
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

function movedChart(register: Register, moved: PlacedChart, runId: string): Applied {
  const { node, box } = moved
  const opened = openedRegister(register, { node })
  if (!opened.ok) return opened
  const started = decide(opened.register, { command: "start", runId, node })
  if (started.decision === "refuse") return { ok: false, refusal: started.code }
  return applySet(started.register, { target: { node }, box: { x: box.x, y: box.y, w: box.cx, h: box.cy } }, runId)
}

function applyChartAdd(
  deck: Deck,
  change: ShapeAdd & { readonly kind: "chart" },
  runId: string,
  base: number,
): Applied {
  const head = { deck: deck.id, base }
  const add = (shares: boolean) =>
    addChartLayer(head, deck, change.slide, change.chart.value, change.box, runId, shares)
  const added = add(true)
  if (!added.ok || added.moved === undefined) return added
  const moved = movedChart(added.register, added.moved, runId)
  return moved.ok ? moved : add(false)
}

function applyAdd(deck: Deck, change: ShapeAdd, runId: string, base: number, images: ImageLookup): Applied {
  if (change.kind === "chart") return applyChartAdd(deck, change, runId, base)
  if ("icon" in change) return addIcon({ deck: deck.id, base }, deck, change.slide, change.icon, change.box, runId)
  if ("image" in change) {
    const image = images(change.image)
    if (image === undefined) return { ok: false, refusal: "image" }
    return addPicture({ deck: deck.id, base }, deck, change.slide, image, change.box, runId)
  }
  const value = change.text?.value
  const opening = typeof value === "string" && openingSlideNumber(value) ? value : ""
  const added = addTextBox({ deck: deck.id, base }, deck, change.slide, change.box, runId, opening)
  const { op: _op, kind: _kind, slide: _slide, box: _box, ...inputs } = change
  if (!added.ok || Object.keys(inputs).length === 0) return added
  return withAdded(added.register, runId, inputs)
}

function hasTraits(change: SetChange): boolean {
  return Object.keys(change).some((key) => key !== "op" && key !== "target")
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
  const { stack, ...traits } = change
  const sourced = withMedia(traits, images)
  if (sourced === null) return { ok: false, refusal: "image" }
  if (stack === undefined || !("node" in change.target)) return applySet(deck.register, sourced, runId)
  const ordered = applyStack(deck, change.target.node, stack, runId, base)
  if (!ordered.ok || !hasTraits(sourced)) return ordered
  return applySet(ordered.register, sourced, runId)
}

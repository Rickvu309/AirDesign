import { readBox } from "./box.js"
import type { Landed, NodeRegister, Register } from "./decide.js"
import type { DeckIndex } from "./deck-index.js"
import {
  legacyElement,
  readElementId,
  readSlideId,
  rootElement,
  slideNode,
  type ElementId,
  type SlideId,
} from "./element-id.js"
import { format, formatOf, newerFormat, converted, type Conversion, type StoredRead } from "./format.js"
import { onlyKeys, record } from "./plain-object.js"
import { formatOne, readPatch, type Row, type ValueHolder } from "./row.js"
import { newerSlideCommand, readSlideState, type SlideCommand } from "./slide-order.js"
import type { Value } from "./value.js"

export type StoredEdit =
  | { readonly value: Value; readonly node?: ElementId; readonly floor?: string }
  | { readonly file: readonly SlideId[]; readonly edits: readonly SlideCommand[] }

const payload = { ok: false, refusal: "payload" } as const
const newer = { ok: false, refusal: "newer" } as const

const rootFields = ["landed", "version", "phase", "runId", "readAt", "guarded", "claimed", "stoppedAt", "b"] as const

function formatOneText(raw: Record<string, unknown>, holder: ValueHolder): unknown {
  if (raw.property !== undefined) return raw
  return { v: 1, patch: { [holder]: { value: { set: raw.value } } } }
}

function formatOneBox(raw: Record<string, unknown>): unknown {
  if (raw.property !== "box") return raw
  const box = record(raw.value)
  if (box === null || !onlyKeys(box, ["x", "y", "cx", "cy"])) return null
  return { v: 1, patch: { box: { x: { set: box.x }, y: { set: box.y }, w: { set: box.cx }, h: { set: box.cy } } } }
}

const fillRowFormat = 28

function slideBackground(raw: Record<string, unknown>): unknown {
  const edit = Array.isArray(raw.edits) && raw.edits.length === 1 ? record(raw.edits[0]) : null
  const id = readSlideId(edit?.id)
  if (edit?.slide !== "background" || id === undefined) return raw
  const value = edit.color === null ? "opening" : { set: { solid: edit.color } }
  const row = readRow({ v: fillRowFormat, patch: { fill: { value } } }, "text")
  return row.ok ? { node: slideNode(id, "slide"), floor: "", value: row.value } : raw
}

function hiddenCount(landed: unknown): number {
  return Array.isArray(landed) ? landed.filter((row) => record(row)?.visible !== true).length : 0
}

function rootShape(raw: Record<string, unknown>): unknown {
  if (!rootFields.some((field) => Object.hasOwn(raw, field))) return raw
  const elements = record(raw.elements)
  if (elements === null) return null
  const root = { ...record(elements[rootElement]), ...raw }
  const first = {
    route: root.route,
    floor: root.floor,
    ...(root.floorBox === undefined ? {} : { floorBox: root.floorBox }),
    landed: root.landed,
    version: root.version ?? (Array.isArray(root.landed) ? root.landed.length + hiddenCount(root.landed) : undefined),
    phase: root.phase,
    runId: root.runId,
    readAt: root.readAt,
    guarded: root.guarded,
    claimed: root.claimed,
    stoppedAt: root.stoppedAt,
    slides: root.slides,
    bytes: root.bytes,
  }
  const legacy = Object.hasOwn(elements, legacyElement) || raw.b == null ? {} : { [legacyElement]: raw.b }
  return {
    route: raw.route,
    ...(raw.index === undefined ? {} : { index: raw.index }),
    floor: raw.floor,
    slides: raw.slides,
    bytes: raw.bytes,
    ...(raw.file === undefined ? {} : { file: raw.file }),
    ...(raw.order === undefined ? {} : { order: raw.order }),
    nodes: raw.nodes,
    readNodes: raw.readNodes,
    elements: { ...elements, ...legacy, [rootElement]: first },
  }
}

function slideOrder(raw: Record<string, unknown>): unknown {
  if (raw.file !== undefined && raw.order !== undefined) return raw
  return { ...raw, file: raw.file ?? [], order: raw.order ?? [] }
}

export const conversions: {
  readonly value: readonly Conversion<ValueHolder>[]
  readonly edit: readonly Conversion<undefined>[]
  readonly register: readonly Conversion<undefined>[]
} = {
  value: [
    { introduced: 2, convert: formatOneText },
    { introduced: 2, convert: formatOneBox },
  ],
  edit: [{ introduced: fillRowFormat, convert: slideBackground }],
  register: [
    { introduced: 2, convert: rootShape },
    { introduced: 2, convert: slideOrder },
  ],
}

function rowStamp(raw: Record<string, unknown>): number {
  return typeof raw.v === "number" ? raw.v : 1
}

function unstamped(): number {
  return 1
}

export function readRow(raw: unknown, holder: ValueHolder): StoredRead<Row> {
  const stored = record(raw)
  if (stored === null) return payload
  if (Object.hasOwn(stored, "v")) {
    const v = stored.v
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 2) return payload
    if (v > format) return newer
  }
  const row = converted(stored, rowStamp, conversions.value, holder)
  const patch = row === null ? null : readPatch(row.patch)
  return row === null || patch === null ? payload : { ok: true, value: { v: rowStamp(row), patch } }
}

export function readStoredValue(raw: unknown, holder: ValueHolder): StoredRead<Value> {
  const read = readRow(raw, holder)
  if (!read.ok || Object.hasOwn(record(raw) ?? {}, "v")) return read
  const [value] = formatOne(read.value.patch, holder) ?? []
  return value === undefined ? payload : { ok: true, value }
}

function storedNode(raw: unknown): ElementId | undefined {
  if (raw === legacyElement) return legacyElement
  return raw === rootElement ? rootElement : readElementId(raw)
}

export function readStoredEdit(raw: unknown): StoredRead<StoredEdit> {
  const stored = record(raw)
  if (stored === null) return payload
  if (newerFormat(stored)) return newer
  const edit = converted(stored, formatOf, conversions.edit, undefined)
  if (edit === null) return payload
  if (Object.hasOwn(edit, "edits")) {
    if (!Array.isArray(edit.edits)) return payload
    if (edit.edits.some(newerSlideCommand)) return newer
    const state = readSlideState({ file: edit.file, order: edit.edits })
    return state === undefined ? payload : { ok: true, value: { file: state.file, edits: state.order } }
  }
  const value = readStoredValue(edit.value, "text")
  if (!value.ok) return value
  const node = edit.node === undefined ? undefined : storedNode(edit.node)
  if ((edit.node !== undefined && node === undefined) || (edit.floor !== undefined && typeof edit.floor !== "string"))
    return payload
  return {
    ok: true,
    value: {
      value: value.value,
      ...(node === undefined ? {} : { node }),
      ...(typeof edit.floor === "string" ? { floor: edit.floor } : {}),
    },
  }
}

function whole(raw: unknown): raw is number {
  return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0
}

function list<T>(raw: unknown, read: (value: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items: T[] = []
  for (const value of raw) {
    const item = read(value)
    if (item === undefined) return undefined
    items.push(item)
  }
  return items
}

function newerRows(raw: unknown): boolean {
  const body = record(raw)
  return (
    Array.isArray(body?.landed) &&
    body.landed.some((row) => {
      const read = readRow(row, "text")
      return !read.ok && read.refusal === "newer"
    })
  )
}

function holdsNewer(deck: Record<string, unknown>, index: unknown): boolean {
  return (
    newerFormat(deck) ||
    newerFormat(index) ||
    newerFormat(record(index)?.next) ||
    newerRows(deck) ||
    newerRows(deck.b) ||
    Object.values(record(deck.elements) ?? {}).some(newerRows) ||
    (Array.isArray(deck.order) && deck.order.some(newerSlideCommand))
  )
}

function landedRow(raw: unknown): Landed | undefined {
  const row = record(raw)
  if (row === null) return undefined
  const { actor, visible, runId } = row
  if ((actor !== "person" && actor !== "agent") || typeof visible !== "boolean") return undefined
  if (runId !== undefined && typeof runId !== "string") return undefined
  const read = readStoredValue(row, "text")
  if (!read.ok) return undefined
  return { ...read.value, actor, visible, ...(runId === undefined ? {} : { runId }) }
}

function nullableWhole(raw: unknown): raw is number | null {
  return raw === null || whole(raw)
}

function nodeBody(raw: unknown): NodeRegister | undefined {
  const body = record(raw)
  if (body === null) return undefined
  const { route, floor, version: kept, phase, runId, readAt, guarded, claimed, stoppedAt, slides, bytes } = body
  if (
    typeof route !== "string" ||
    typeof floor !== "string" ||
    (kept !== undefined && !whole(kept)) ||
    (phase !== "idle" && phase !== "running" && phase !== "stopped" && phase !== "undone") ||
    (runId !== null && typeof runId !== "string") ||
    !nullableWhole(readAt) ||
    typeof guarded !== "boolean" ||
    !nullableWhole(claimed) ||
    !nullableWhole(stoppedAt) ||
    !whole(slides) ||
    !whole(bytes)
  )
    return undefined
  const landed = list(body.landed, landedRow)
  const floorBox = body.floorBox === undefined ? undefined : readBox(body.floorBox)
  if (landed === undefined || floorBox === null) return undefined
  return {
    route,
    floor,
    ...(floorBox === undefined ? {} : { floorBox }),
    landed,
    ...(kept === undefined ? {} : { version: kept }),
    phase,
    runId,
    readAt,
    guarded,
    claimed,
    stoppedAt,
    slides,
    bytes,
  }
}

function lastRun(raw: unknown): Register["lastRun"] {
  const run = record(raw)
  if (run === null || typeof run.runId !== "string" || !whole(run.since) || !whole(run.revision)) return undefined
  return { runId: run.runId, since: run.since, revision: run.revision }
}

function optional<T>(raw: unknown, read: (value: unknown) => T | undefined): { value: T | undefined } | null {
  if (raw === undefined) return { value: undefined }
  const value = read(raw)
  return value === undefined ? null : { value }
}

function elementMap(raw: unknown): Record<ElementId, NodeRegister> | undefined {
  const bodies = record(raw)
  if (bodies === null) return undefined
  const elements: Record<ElementId, NodeRegister> = {}
  for (const [key, value] of Object.entries(bodies)) {
    const id = storedNode(key)
    const body = nodeBody(value)
    if (id === undefined || body === undefined) return undefined
    elements[id] = body
  }
  return elements
}

function storedIndex(raw: unknown): DeckIndex | undefined {
  return record(raw) === null ? undefined : (raw as DeckIndex)
}

function registerOf(deck: Record<string, unknown>): Register | undefined {
  const { route, floor, slides, bytes } = deck
  if (typeof route !== "string" || typeof floor !== "string" || !whole(slides) || !whole(bytes)) return undefined
  const nodes = list(deck.nodes, storedNode)
  const readNodes = deck.readNodes === null ? null : list(deck.readNodes, storedNode)
  const elements = elementMap(deck.elements)
  const state = readSlideState({ file: deck.file, order: deck.order })
  const index = optional(deck.index, storedIndex)
  const sectionStarts = optional(deck.sectionStarts, (value) => list(value, readSlideId))
  const ended = optional(deck.ended, (value) => list(value, (id) => (typeof id === "string" ? id : undefined)))
  const run = optional(deck.lastRun, lastRun)
  if (
    nodes === undefined ||
    readNodes === undefined ||
    elements === undefined ||
    state === undefined ||
    index === null ||
    sectionStarts === null ||
    ended === null ||
    run === null
  )
    return undefined
  return {
    route,
    floor,
    slides,
    bytes,
    ...state,
    nodes,
    readNodes,
    elements,
    ...(index.value === undefined ? {} : { index: index.value }),
    ...(sectionStarts.value === undefined ? {} : { sectionStarts: sectionStarts.value }),
    ...(ended.value === undefined ? {} : { ended: ended.value }),
    ...(run.value === undefined ? {} : { lastRun: run.value }),
  }
}

export function readRegister(raw: unknown, index?: unknown): StoredRead<Register> {
  const stored = record(raw)
  if (stored === null) return payload
  const deck = index === undefined ? stored : { ...stored, index }
  if (holdsNewer(deck, deck.index)) return newer
  const current = converted(deck, unstamped, conversions.register, undefined)
  const register = current === null ? undefined : registerOf(current)
  return register === undefined ? payload : { ok: true, value: register }
}

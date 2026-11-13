import type { DeckIndex, IndexElement } from "./deck-index.js"
import { readSlideId, slideId, type SlideId } from "./element-id.js"
import { elementCommand, elementRefusal, readElementCommand, type ElementCommand } from "./element-order.js"
import { limits } from "./limits.js"
import { orderKeyBetween, readOrderKey, type OrderKey } from "./order-key.js"
import { readFloor } from "./slide-floor.js"

export type SlideAdd = {
  readonly slide: "add"
  readonly id: SlideId
  readonly after: SlideId
  readonly key: OrderKey
  readonly layout: SlideId
  readonly layoutPart?: string
  readonly floor?: readonly IndexElement[]
}

export type SlideClone = {
  readonly slide: "clone"
  readonly id: SlideId
  readonly source: SlideId
  readonly key: OrderKey
  readonly floor?: readonly IndexElement[]
}

export type SlideRemove = {
  readonly slide: "remove"
  readonly id: SlideId
}

export type SlideMove = {
  readonly slide: "move"
  readonly id: SlideId
  readonly key: OrderKey
}

export type SlideRestore = {
  readonly slide: "restore"
  readonly id: SlideId
  readonly key: OrderKey
}

export type SlideCommand = (SlideAdd | SlideClone | SlideRemove | SlideMove | SlideRestore | ElementCommand) & {
  readonly runId?: string
}

export type SlideBirth =
  | { readonly from: "file" }
  | { readonly from: "blank"; readonly layout: SlideId; readonly layoutPart?: string }
  | { readonly from: "clone"; readonly source: SlideId }

export type FoldedSlide = {
  readonly id: SlideId
  readonly key: OrderKey
  readonly birth: SlideBirth
  readonly present: boolean
}

export type SlideState = {
  readonly file: readonly SlideId[]
  readonly order: readonly SlideCommand[]
}

export type SlideRefusal = "stale" | "dead" | "present" | "limit" | "group-box" | "locked" | "kind"

export function openSlides(): SlideState {
  return { file: [], order: [] }
}

function sameIds(left: readonly SlideId[], right: readonly SlideId[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function fileKeys(file: readonly SlideId[]): Map<SlideId, OrderKey> {
  const keys = new Map<SlideId, OrderKey>()
  let previous: OrderKey | null = null
  for (const id of file) {
    const key = orderKeyBetween(previous, null)
    keys.set(id, key)
    previous = key
  }
  return keys
}

function placed(spot: FoldedSlide, command: SlideCommand): FoldedSlide {
  if (command.slide === "remove") return { ...spot, present: false }
  if (command.slide === "move") return { ...spot, key: command.key }
  if (command.slide === "restore") return { ...spot, key: command.key, present: true }
  return spot
}

export function foldSlides(state: SlideState): readonly FoldedSlide[] {
  const keys = fileKeys(state.file)
  const spots = new Map<SlideId, FoldedSlide>()
  for (const id of state.file) {
    const key = keys.get(id)
    if (key === undefined) throw new Error("slide")
    spots.set(id, { id, key, birth: { from: "file" }, present: true })
  }
  for (const command of state.order) {
    if (elementCommand(command)) continue
    if (command.slide === "add") {
      spots.set(command.id, {
        id: command.id,
        key: command.key,
        birth:
          command.layoutPart === undefined
            ? { from: "blank", layout: command.layout }
            : { from: "blank", layout: command.layout, layoutPart: command.layoutPart },
        present: true,
      })
      continue
    }
    if (command.slide === "clone") {
      spots.set(command.id, {
        id: command.id,
        key: command.key,
        birth: { from: "clone", source: command.source },
        present: true,
      })
      continue
    }
    const spot = spots.get(command.id)
    if (spot === undefined) throw new Error("slide")
    spots.set(command.id, placed(spot, command))
  }
  return [...spots.values()]
}

function byKey(left: FoldedSlide, right: FoldedSlide): number {
  if (left.key < right.key) return -1
  if (left.key > right.key) return 1
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

export function presentSlides(state: SlideState): readonly FoldedSlide[] {
  return foldSlides(state)
    .filter((spot) => spot.present)
    .sort(byKey)
}

export function orderKeyAfter(present: readonly FoldedSlide[], after: SlideId): OrderKey | null {
  const index = present.findIndex((spot) => spot.id === after)
  if (index < 0) return null
  return orderKeyBetween(present[index]?.key ?? null, present[index + 1]?.key ?? null)
}

export function nextSlideId(ids: readonly string[]): SlideId {
  let max = 0
  for (const id of ids) {
    const number = Number(id)
    if (Number.isSafeInteger(number) && number > max) max = number
  }
  return slideId(String(max + 1))
}

export function slideGone(state: SlideState, id: string): boolean {
  const spot = foldSlides(state).find((item) => item.id === id)
  return spot !== undefined && !spot.present
}

function known(state: SlideState, id: SlideId): boolean {
  if (state.file.includes(id)) return true
  return state.order.some((command) => (command.slide === "add" || command.slide === "clone") && command.id === id)
}

export function applySlide(
  state: SlideState & { readonly index?: DeckIndex },
  file: readonly SlideId[],
  command: SlideCommand,
): { readonly ok: true; readonly state: SlideState } | { readonly ok: false; readonly code: SlideRefusal } {
  if (file.length === 0 || new Set(file).size !== file.length) return { ok: false, code: "dead" }
  if (state.file.length > 0 && !sameIds(state.file, file)) return { ok: false, code: "stale" }
  const withFile = state.file.length === 0 ? { file, order: state.order } : state
  const present = presentSlides(withFile)
  const ids = new Set(present.map((spot) => spot.id))
  if (elementCommand(command)) {
    if (!ids.has(command.id)) return { ok: false, code: "dead" }
    const refusal = elementRefusal({ ...withFile, ...index(state) }, command)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "remove") {
    if (!ids.has(command.id) || present.length === 1) return { ok: false, code: "dead" }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "move") {
    if (!ids.has(command.id)) return { ok: false, code: "dead" }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "restore") {
    if (ids.has(command.id) || !known(withFile, command.id)) return { ok: false, code: "dead" }
    if (present.length >= limits.slides) return { ok: false, code: "limit" }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (known(withFile, command.id) || ids.has(command.id)) return { ok: false, code: "present" }
  if (present.length >= limits.slides) return { ok: false, code: "limit" }
  if (command.slide === "add") {
    if (!ids.has(command.after) || !ids.has(command.layout)) return { ok: false, code: "dead" }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (!ids.has(command.source)) return { ok: false, code: "dead" }
  return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
}

function index(state: { readonly index?: DeckIndex }): { readonly index?: DeckIndex } {
  return state.index === undefined ? {} : { index: state.index }
}

function slideList(raw: unknown): readonly SlideId[] | undefined {
  if (!Array.isArray(raw) || raw.length > limits.slides) return undefined
  const ids: SlideId[] = []
  for (const item of raw) {
    const id = readSlideId(item)
    if (id === undefined) return undefined
    ids.push(id)
  }
  return ids
}

const layoutPartPattern = /^ppt(?:\/[A-Za-z0-9_-]{1,100}){1,4}\.xml$/

function readLayoutPart(raw: unknown): string | undefined {
  return typeof raw === "string" && layoutPartPattern.test(raw) ? raw : undefined
}

function commandOf(raw: Record<string, unknown>): SlideCommand | undefined {
  const id = readSlideId(raw.id)
  if (id === undefined) return undefined
  if (raw.slide === "element-add" || raw.slide === "element-remove" || raw.slide === "element-restore")
    return readElementCommand(raw, id)
  if (raw.slide === "remove") return { slide: "remove", id }
  const key = readOrderKey(raw.key)
  if (key === undefined) return undefined
  if (raw.slide === "move") return { slide: "move", id, key }
  if (raw.slide === "restore") return { slide: "restore", id, key }
  const floor = Object.hasOwn(raw, "floor") ? readFloor(raw.floor, id) : null
  if (floor === undefined) return undefined
  const floored = floor === null ? {} : { floor }
  if (raw.slide === "clone") {
    const source = readSlideId(raw.source)
    if (source === undefined) return undefined
    return { slide: "clone", id, source, key, ...floored }
  }
  if (raw.slide !== "add") return undefined
  const after = readSlideId(raw.after)
  const layout = readSlideId(raw.layout)
  if (after === undefined || layout === undefined) return undefined
  if (!Object.hasOwn(raw, "layoutPart")) return { slide: "add", id, after, key, layout, ...floored }
  const layoutPart = readLayoutPart(raw.layoutPart)
  if (layoutPart === undefined) return undefined
  return { slide: "add", id, after, key, layout, layoutPart, ...floored }
}

export function readSlideState(raw: unknown): SlideState | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const body = raw as Record<string, unknown>
  const file = slideList(body.file)
  if (file === undefined || !Array.isArray(body.order)) return undefined
  const order: SlideCommand[] = []
  for (const item of body.order) {
    if (typeof item !== "object" || item === null) return undefined
    const command = commandOf(item as Record<string, unknown>)
    if (command === undefined) return undefined
    if (item.runId !== undefined && (typeof item.runId !== "string" || item.runId.length > 64)) return undefined
    order.push(item.runId === undefined ? command : { ...command, runId: item.runId })
  }
  return { file, order }
}

import { slideBirths } from "./slide-births.js"
import { setRefusal } from "./grid-set.js"
import { groupRefusal as moveRefusal } from "./grid-move.js"
import { foldGrid, orderedSpots, turnRefusal, readGridCommand, type V1Command } from "./grid-order.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { readSlideId, slideId, type SlideId } from "./element-id.js"
import { groupCommand, groupRefusal, readGroupCommand, type GroupCommand } from "./element-group.js"
import { elementCommand, elementRefusal, readElementCommand, type ElementCommand } from "./element-order.js"
import { readElementOrder, stackRefusal } from "./element-stack.js"
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

export type LegacySlideCommand = (
  | SlideAdd
  | SlideClone
  | SlideRemove
  | SlideMove
  | SlideRestore
  | ElementCommand
  | GroupCommand
) & {
  readonly runId?: string
}

export type SlideCommand = (LegacySlideCommand & { readonly grid?: never }) | V1Command

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

export function foldSlides(state: SlideState): readonly FoldedSlide[] {
  return foldGrid(state).spots
}

export function presentSlides(state: SlideState): readonly FoldedSlide[] {
  return orderedSpots(foldSlides(state))
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
  return state.order.some((command) => slideBirths(command).some((birth) => birth.id === id))
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
    const seen = { ...withFile, ...index(state) }
    const refusal = command.slide === "element-order" ? stackRefusal(seen, command) : elementRefusal(seen, command)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (groupCommand(command)) {
    if (!ids.has(command.id)) return { ok: false, code: "dead" }
    const refusal = groupRefusal({ ...withFile, ...index(state) }, command)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "remove-many" || command.slide === "clone-many") {
    const refusal = setRefusal(withFile, command, ids)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "move-many") {
    const refusal = moveRefusal(withFile, command)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "grid-turn") {
    const refusal = turnRefusal(withFile, command.turn)
    if (refusal !== null) return { ok: false, code: refusal }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "remove") {
    if (!ids.has(command.id) || present.length === 1) return { ok: false, code: "dead" }
    return { ok: true, state: { ...withFile, order: [...withFile.order, command] } }
  }
  if (command.slide === "move") {
    if (!ids.has(command.id)) return { ok: false, code: "dead" }
    if (command.grid === 1 && command.after !== null && (command.after === command.id || !ids.has(command.after)))
      return { ok: false, code: "dead" }
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
  if (raw.grid !== undefined) return readGridCommand(raw)
  const id = readSlideId(raw.id)
  if (id === undefined) return undefined
  if (raw.slide === "element-order") return readElementOrder(raw, id)
  if (raw.slide === "element-add" || raw.slide === "element-remove" || raw.slide === "element-restore")
    return readElementCommand(raw, id)
  if (raw.slide === "element-group" || raw.slide === "element-ungroup" || raw.slide === "element-regroup")
    return readGroupCommand(raw, id)
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

export function newerSlideCommand(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || !("slide" in raw)) return false
  if ("grid" in raw && raw.grid !== undefined && raw.grid !== 1) return true
  return (
    typeof raw.slide === "string" &&
    ![
      "add",
      "clone",
      "remove",
      "move",
      "restore",
      "grid-turn",
      "move-many",
      "remove-many",
      "clone-many",
      "element-add",
      "element-remove",
      "element-restore",
      "element-order",
      "element-group",
      "element-ungroup",
      "element-regroup",
    ].includes(raw.slide)
  )
}

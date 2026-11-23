import { foldGrid, orderedSpots, type GridCommand } from "./grid-order.js"
import type { DeckIndex, IndexElement } from "./deck-index.js"
import { slideId, type SlideId } from "./element-id.js"
import { type GroupCommand } from "./element-group.js"
import { type ElementCommand } from "./element-order.js"
import { orderKeyBetween, type OrderKey } from "@airdesign/doom"

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

export type SlideCommand = (LegacySlideCommand & { readonly grid?: never }) | GridCommand

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
  readonly index?: DeckIndex
  readonly sectionStarts?: readonly SlideId[]
}

type SlidesCache = {
  readonly file: readonly SlideId[]
  readonly sectionStarts: readonly SlideId[] | undefined
  readonly spots: readonly FoldedSlide[]
  readonly gone: ReadonlySet<string>
}

const foldedSlides = new WeakMap<readonly SlideCommand[], WeakMap<object, SlidesCache>>()
const noSlideIndex = {}

function slidesOf(state: SlideState): SlidesCache {
  let byIndex = foldedSlides.get(state.order)
  if (byIndex === undefined) {
    byIndex = new WeakMap<object, SlidesCache>()
    foldedSlides.set(state.order, byIndex)
  }
  const key = state.index ?? noSlideIndex
  const kept = byIndex.get(key)
  if (kept !== undefined && kept.file === state.file && kept.sectionStarts === state.sectionStarts) return kept
  const spots = foldGrid(state).spots
  const gone = new Set<string>()
  for (const spot of spots) if (!spot.present) gone.add(spot.id)
  const built: SlidesCache = { file: state.file, sectionStarts: state.sectionStarts, spots, gone }
  byIndex.set(key, built)
  return built
}

export function foldSlides(state: SlideState): readonly FoldedSlide[] {
  return slidesOf(state).spots
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

import type { SlideId } from "./element-id.js"
import { gridCommandVersion, orderedSpots, type GridCopy, type GridGroup, type GridCommand } from "./grid-order.js"
import { limits } from "@airdesign/doom"
import { orderKeyBetween } from "@airdesign/doom"
import { slideBirths } from "./slide-births.js"
import {
  foldSlides,
  nextSlideId,
  type FoldedSlide,
  type LegacySlideCommand,
  type SlideRefusal,
  type SlideState,
} from "./slide-order.js"

type SlideSet = Extract<GridCommand, { readonly slide: "remove-many" | "clone-many" }>

export function setRefusal(state: SlideState, command: SlideSet, present: ReadonlySet<SlideId>): SlideRefusal | null {
  if (command.slide === "remove-many") {
    const ids = new Set(command.ids)
    return ids.size !== command.ids.length || ids.size >= present.size || command.ids.some((id) => !present.has(id))
      ? "dead"
      : null
  }
  const ids = new Set(command.copies.map((copy) => copy.id))
  if (
    ids.size !== command.copies.length ||
    state.file.some((id) => ids.has(id)) ||
    state.order.some((row) => slideBirths(row).some((birth) => ids.has(birth.id)))
  )
    return "present"
  const sources = new Set(command.copies.map((copy) => copy.source))
  if (sources.size !== command.copies.length || [...sources].some((source) => !present.has(source))) return "dead"
  return present.size + ids.size > limits.slides ? "limit" : null
}

export function cloneMany(
  state: SlideState,
  ids: readonly SlideId[],
  floor: (source: SlideId, id: SlideId) => GridCopy["floor"],
): Extract<SlideSet, { slide: "clone-many" }> | null {
  const spots = foldSlides(state)
  const taken = spots.map((spot) => spot.id)
  const sources = orderedSpots(spots).filter((spot) => ids.includes(spot.id))
  if (sources.length !== ids.length) return null
  const copies = sources.map(({ id: source }) => {
    const id = nextSlideId(taken)
    taken.push(id)
    const opening = floor(source, id)
    return { id, source, ...(opening === undefined ? {} : { floor: opening }) }
  })
  const [first, ...rest] = copies
  return first === undefined ? null : { slide: "clone-many", grid: gridCommandVersion(state), copies: [first, ...rest] }
}

export function changeSet(
  before: readonly FoldedSlide[],
  groups: readonly GridGroup[],
  command: SlideSet,
): {
  readonly spots: readonly FoldedSlide[]
  readonly heads: Set<SlideId>
  readonly effects: readonly LegacySlideCommand[]
} {
  const run = command.runId === undefined ? {} : { runId: command.runId }
  if (command.slide === "remove-many") {
    const ids = new Set(command.ids)
    const spots = before.filter((spot) => ids.has(spot.id)).map((spot) => ({ ...spot, present: false }))
    const heads = new Set(groups.flatMap((group) => group.find((id) => !ids.has(id)) ?? []))
    return { spots, heads, effects: spots.map(({ id }) => ({ slide: "remove", id, ...run })) }
  }
  const copies = new Map(command.copies.map((copy) => [copy.source, copy]))
  const last = before.findLastIndex((spot) => copies.has(spot.id))
  let left = before[last]?.key ?? null
  const right = before[last + 1]?.key ?? null
  const effects = before.flatMap(({ id }) => {
    const copy = copies.get(id)
    if (copy === undefined) return []
    left = orderKeyBetween(left, right)
    return [{ slide: "clone" as const, ...copy, key: left, ...run }]
  })
  const spots = effects.map(({ id, key, source }) => ({
    id,
    key,
    birth: { from: "clone" as const, source },
    present: true,
  }))
  return { spots, heads: new Set(groups.map((group) => group[0])), effects }
}

import type { SlideId } from "./element-id.js"
import { type GridGroup, type GridCommand } from "./grid-order.js"
import { orderKeyBetween } from "@airdesign/doom"
import { type FoldedSlide, type LegacySlideCommand } from "./slide-order.js"

type SlideSet = Extract<GridCommand, { readonly slide: "remove-many" | "clone-many" }>

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

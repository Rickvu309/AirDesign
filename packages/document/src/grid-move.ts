import type { SlideId } from "./element-id.js"
import { gridRows, type GridRow, type V1Command } from "./grid-order.js"
import { orderKeyBetween } from "./order-key.js"
import {
  presentSlides,
  type FoldedSlide,
  type LegacySlideCommand,
  type SlideRefusal,
  type SlideState,
} from "./slide-order.js"

type Move = Extract<V1Command, { readonly slide: "move-many" }>

export function groupRefusal(state: SlideState, command: Move): SlideRefusal | null {
  const present = new Set(presentSlides(state).map((spot) => spot.id))
  if (
    command.ids.some((id) => !present.has(id)) ||
    (command.after !== null && (!present.has(command.after) || command.ids.includes(command.after)))
  )
    return "dead"
  if (
    command.row === "keep" &&
    !gridRows(state).some((row) => row.length === command.ids.length && row.every((id) => command.ids.includes(id)))
  )
    return "stale"
  return null
}

export function moveGroup(
  before: readonly FoldedSlide[],
  rows: readonly GridRow[],
  command: Move,
): {
  readonly spots: readonly FoldedSlide[]
  readonly heads: Set<SlideId>
  readonly effects: readonly LegacySlideCommand[]
} {
  const held = new Set(command.ids)
  const moving = before.filter((spot) => held.has(spot.id))
  const remaining = before.filter((spot) => !held.has(spot.id))
  const source = rows.map((row) => row.filter((id) => !held.has(id))).filter((row) => row.length > 0)
  const heads = new Set(source.flatMap((row) => (row[0] === undefined ? [] : [row[0]])))
  const after = command.after
  const anchor =
    after === null ? null : command.row === "same" ? after : source.find((row) => row.includes(after))?.at(-1)
  const at = anchor === null ? -1 : remaining.findIndex((spot) => spot.id === anchor)
  let key = remaining[at]?.key ?? null
  const right = remaining[at + 1]?.key ?? null
  const spots = moving.map((spot) => {
    key = orderKeyBetween(key, right)
    return { ...spot, key }
  })
  const first = spots[0]
  if (first !== undefined && (command.row !== "same" || at === -1)) {
    heads.add(first.id)
    if (command.row === "same" && remaining[0] !== undefined) heads.delete(remaining[0].id)
  }
  const effects: LegacySlideCommand[] = spots.map((spot) => ({
    slide: "move",
    id: spot.id,
    key: spot.key,
    ...(command.runId === undefined ? {} : { runId: command.runId }),
  }))
  return { spots, heads, effects }
}

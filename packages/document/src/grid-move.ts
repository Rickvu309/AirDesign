import type { SlideId } from "./element-id.js"
import { gridRows, type GridRow, type GridCommand } from "./grid-order.js"
import { orderKeyBetween } from "./order-key.js"
import {
  presentSlides,
  type FoldedSlide,
  type LegacySlideCommand,
  type SlideRefusal,
  type SlideState,
} from "./slide-order.js"

type Move = Extract<GridCommand, { readonly slide: "move-many" }>

export function groupRefusal(state: SlideState, command: Move): SlideRefusal | null {
  const present = new Set(presentSlides(state).map((spot) => spot.id))
  const anchor = command.row === "before" ? command.before : command.after
  if (
    command.ids.some((id) => !present.has(id)) ||
    (anchor !== null && (!present.has(anchor) || command.ids.includes(anchor)))
  )
    return "dead"
  if (
    command.row === "keep" &&
    !gridRows(state, command.grid).some(
      (row) => row.length === command.ids.length && row.every((id) => command.ids.includes(id)),
    )
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
  const anchor = command.row === "before" ? command.before : command.after
  const placement = gridMovePlacement(rows, command.ids, anchor, command.row)
  const held = new Set(command.ids)
  const moving = before.filter((spot) => held.has(spot.id))
  const remaining = before.filter((spot) => !held.has(spot.id))
  const at = remaining.findIndex((spot) => spot.id === placement.after)
  const heads = new Set(placement.rows.flatMap((row) => row.slice(0, 1)))
  let key = remaining[at]?.key ?? null
  const right = remaining[at + 1]?.key ?? null
  const spots = moving.map((spot) => {
    key = orderKeyBetween(key, right)
    return { ...spot, key }
  })
  const effects: LegacySlideCommand[] = spots.map((spot) => ({
    slide: "move",
    id: spot.id,
    key: spot.key,
    ...(command.runId === undefined ? {} : { runId: command.runId }),
  }))
  return { spots, heads, effects }
}

export function gridMovePlacement<Id>(
  rows: readonly (readonly Id[])[],
  ids: readonly Id[],
  anchor: Id | null,
  side: Move["row"],
) {
  const held = new Set(ids)
  const moving = rows.flat().filter((id) => held.has(id))
  const next = rows.map((row) => row.filter((id) => !held.has(id))).filter((row) => row.length > 0)
  const number = anchor === null ? -1 : next.findIndex((row) => row.includes(anchor))
  const row = next[number]
  const separate = side === "new" || side === "keep"
  const at = row === undefined || anchor === null ? 0 : row.indexOf(anchor) + (side === "before" ? 0 : 1)
  const after = separate ? (row?.at(-1) ?? null) : (row?.[at - 1] ?? next[number - 1]?.at(-1) ?? null)
  if (moving.length > 0) {
    if (separate || next.length === 0) next.splice(number + 1, 0, moving)
    else (row ?? next[0])?.splice(at, 0, ...moving)
  }
  return { after, rows: next }
}

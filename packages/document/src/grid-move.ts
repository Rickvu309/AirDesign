import type { SlideId } from "./element-id.js"
import { gridGroups, type GridGroup, type GridCommand } from "./grid-order.js"
import { orderKeyBetween } from "@airdesign/doom"
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
    !gridGroups(state, command.grid).some(
      (group) => group.length === command.ids.length && group.every((id) => command.ids.includes(id)),
    )
  )
    return "stale"
  return null
}

export function moveGroup(
  before: readonly FoldedSlide[],
  groups: readonly GridGroup[],
  command: Move,
): {
  readonly spots: readonly FoldedSlide[]
  readonly heads: Set<SlideId>
  readonly effects: readonly LegacySlideCommand[]
} {
  const anchor = command.row === "before" ? command.before : command.after
  const placement = gridMovePlacement(groups, command.ids, anchor, command.row)
  const held = new Set(command.ids)
  const moving = before.filter((spot) => held.has(spot.id))
  const remaining = before.filter((spot) => !held.has(spot.id))
  const at = remaining.findIndex((spot) => spot.id === placement.after)
  const heads = new Set(placement.groups.flatMap((group) => group.slice(0, 1)))
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
  groups: readonly (readonly Id[])[],
  ids: readonly Id[],
  anchor: Id | null,
  side: Move["row"],
) {
  const held = new Set(ids)
  const moving = groups.flat().filter((id) => held.has(id))
  const next = groups.map((group) => group.filter((id) => !held.has(id))).filter((group) => group.length > 0)
  const number = anchor === null ? -1 : next.findIndex((group) => group.includes(anchor))
  const group = next[number]
  const separate = side === "new" || side === "keep"
  const at = group === undefined || anchor === null ? 0 : group.indexOf(anchor) + (side === "before" ? 0 : 1)
  const after = separate ? (group?.at(-1) ?? null) : (group?.[at - 1] ?? next[number - 1]?.at(-1) ?? null)
  if (moving.length > 0) {
    if (separate || next.length === 0) next.splice(number + 1, 0, moving)
    else (group ?? next[0])?.splice(at, 0, ...moving)
  }
  return { after, groups: next }
}

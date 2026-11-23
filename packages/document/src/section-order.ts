import { foldGrid, orderedSpots } from "./grid-order.js"
import type { SlideId } from "./element-id.js"
import type { OrderKey } from "@airdesign/doom"
import { foldSlides, type SlideState, type LegacySlideCommand } from "./slide-order.js"

export type FileSection = { readonly name: string; readonly slides: readonly string[] }
export type Section = { readonly name: string; readonly slides: readonly SlideId[] }

export function sectionRuns(
  file: readonly SlideId[],
  effects: readonly LegacySlideCommand[],
  ids: readonly SlideId[],
  base: readonly (readonly string[])[],
): readonly (readonly SlideId[])[] {
  if (base.length === 0) return []
  const member = new Map<string, number>()
  for (const [number, section] of base.entries()) {
    for (const id of section) member.set(id, number)
  }
  if (file.some((id) => !member.has(id))) return []
  const held = new Map<SlideId, Map<OrderKey, number>>()
  const hold = (id: SlideId, key: OrderKey) => {
    const keys = held.get(id) ?? new Map<OrderKey, number>()
    keys.set(key, member.get(id) ?? 0)
    held.set(id, keys)
  }
  const placed = new Map<SlideId, OrderKey | null>()
  for (const spot of foldSlides({ file, order: [] })) {
    hold(spot.id, spot.key)
    placed.set(spot.id, spot.key)
  }
  for (const command of effects) {
    if (command.slide === "add") member.set(command.id, member.get(command.after) ?? 0)
    if (command.slide === "clone") member.set(command.id, member.get(command.source) ?? 0)
    if (command.slide === "add" || command.slide === "clone" || command.slide === "restore") {
      hold(command.id, command.key)
      placed.set(command.id, command.key)
    }
    if (command.slide === "remove") placed.set(command.id, null)
    if (command.slide !== "move") continue
    placed.set(command.id, command.key)
    const returned = held.get(command.id)?.get(command.key)
    const near = returned === undefined ? neighbour(placed, command.id, command.key) : undefined
    member.set(command.id, returned ?? member.get(near ?? command.id) ?? 0)
    hold(command.id, command.key)
  }
  const grouped = base.map((): SlideId[] => [])
  let current = 0
  for (const id of ids) {
    current = Math.max(current, member.get(id) ?? 0)
    grouped[current]?.push(id)
  }
  return grouped
}

function neighbour(placed: ReadonlyMap<SlideId, OrderKey | null>, id: SlideId, key: OrderKey): SlideId | undefined {
  const earlier = (leftId: SlideId, left: OrderKey, rightId: SlideId, right: OrderKey) =>
    left < right || (left === right && leftId < rightId)
  let before: [SlideId, OrderKey] | undefined
  let after: [SlideId, OrderKey] | undefined
  for (const [other, at] of placed) {
    if (other === id || at === null) continue
    if (earlier(other, at, id, key)) {
      if (before === undefined || earlier(before[0], before[1], other, at)) before = [other, at]
    } else if (after === undefined || earlier(other, at, after[0], after[1])) after = [other, at]
  }
  return (before ?? after)?.[0]
}

export function foldSections(state: SlideState, base: readonly FileSection[]): readonly Section[] {
  if (base.length === 0) return []
  const folded = foldGrid(state)
  return sectionRuns(
    state.file,
    folded.effects,
    orderedSpots(folded.spots).map((spot) => spot.id),
    base.map((section) => section.slides),
  ).map((slides, position) => ({ name: base[position]!.name, slides }))
}

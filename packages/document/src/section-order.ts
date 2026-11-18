import { foldGrid, orderedSpots } from "./grid-order.js"
import type { SlideId } from "./element-id.js"
import type { OrderKey } from "./order-key.js"
import { foldSlides, presentSlides, type SlideState, type LegacySlideCommand } from "./slide-order.js"

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
  for (const spot of foldSlides({ file, order: [] })) hold(spot.id, spot.key)
  for (const [position, command] of effects.entries()) {
    if (command.slide === "add") member.set(command.id, member.get(command.after) ?? 0)
    if (command.slide === "clone") member.set(command.id, member.get(command.source) ?? 0)
    if (command.slide === "add" || command.slide === "clone" || command.slide === "restore")
      hold(command.id, command.key)
    if (command.slide !== "move") continue
    const returned = held.get(command.id)?.get(command.key)
    if (returned !== undefined) member.set(command.id, returned)
    else {
      const present = presentSlides({ file, order: effects.slice(0, position + 1) })
      const at = present.findIndex((spot) => spot.id === command.id)
      const near = at > 0 ? present[at - 1] : present[at + 1]
      member.set(command.id, member.get(near?.id ?? command.id) ?? 0)
    }
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

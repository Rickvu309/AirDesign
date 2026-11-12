import type { SlideId } from "./element-id.js"
import type { OrderKey } from "./order-key.js"
import { foldSlides, presentSlides, type SlideState } from "./slide-order.js"

export type FileSection = { readonly name: string; readonly slides: readonly string[] }
export type Section = { readonly name: string; readonly slides: readonly SlideId[] }

function neighbourSection(state: SlideState, upTo: number, id: SlideId, member: ReadonlyMap<string, number>) {
  const present = presentSlides({ file: state.file, order: state.order.slice(0, upTo + 1) })
  const at = present.findIndex((spot) => spot.id === id)
  const near = at > 0 ? present[at - 1] : present[at + 1]
  return near === undefined ? member.get(id) : member.get(near.id)
}

export function foldSections(state: SlideState, base: readonly FileSection[]): readonly Section[] {
  if (base.length === 0) return []
  const member = new Map<string, number>()
  for (const [number, section] of base.entries()) {
    for (const id of section.slides) member.set(id, number)
  }
  if (state.file.some((id) => !member.has(id))) return []
  const held = new Map<SlideId, Map<OrderKey, number>>()
  const hold = (id: SlideId, key: OrderKey) => {
    const keys = held.get(id) ?? new Map<OrderKey, number>()
    keys.set(key, member.get(id) ?? 0)
    held.set(id, keys)
  }
  for (const spot of foldSlides({ file: state.file, order: [] })) hold(spot.id, spot.key)
  for (const [position, command] of state.order.entries()) {
    if (command.slide === "add") member.set(command.id, member.get(command.after) ?? 0)
    if (command.slide === "clone") member.set(command.id, member.get(command.source) ?? 0)
    if (command.slide === "add" || command.slide === "clone") hold(command.id, command.key)
    if (command.slide !== "move") continue
    const returned = held.get(command.id)?.get(command.key)
    member.set(command.id, returned ?? neighbourSection(state, position, command.id, member) ?? 0)
    hold(command.id, command.key)
  }
  const grouped = base.map((section): { name: string; slides: SlideId[] } => ({ name: section.name, slides: [] }))
  let current = 0
  for (const spot of presentSlides(state)) {
    current = Math.max(current, member.get(spot.id) ?? 0)
    grouped[current]?.slides.push(spot.id)
  }
  return grouped
}

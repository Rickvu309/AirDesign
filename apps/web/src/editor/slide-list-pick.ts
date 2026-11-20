import type { SlideId } from "@airdesign/document"
import { pickedSlides, pickRange, pickToggle, prunedPick, toggledCurrent, type GridPick } from "@/editor/grid-selection"

export type SlidePress = "only" | "range" | "toggle" | "menu"

export type ListPick = { readonly pick: GridPick; readonly current: number }

function several(pick: GridPick): GridPick {
  return pick !== null && pick.slides.size > 1 ? pick : null
}

export function slidePress(event: {
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly ctrlKey: boolean
}): SlidePress {
  if (event.shiftKey) return "range"
  return event.metaKey || event.ctrlKey ? "toggle" : "only"
}

export function pressedPick(pick: GridPick, index: number, current: number, press: SlidePress): ListPick {
  if (press === "menu" && pick?.slides.has(index) === true) return { pick, current }
  if (press === "only" || press === "menu") return { pick: null, current: index }
  const next = press === "range" ? pickRange(pick, index, current) : pickToggle(pick, index, current)
  return { pick: several(next), current: toggledCurrent(next, index) }
}

export function livePick(pick: GridPick, current: number, count: number, ids?: readonly SlideId[]): GridPick {
  const pruned = several(prunedPick(pick, count, ids))
  return pruned?.slides.has(current) === true ? pruned : null
}

export function heldSlides(pick: GridPick, current: number): readonly number[] {
  return pickedSlides(pick, current)
}

export function setDropPlace(held: readonly number[], index: number): number | null {
  if (held.includes(index)) return null
  return index > (held.at(-1) ?? index) ? index + 1 : index
}

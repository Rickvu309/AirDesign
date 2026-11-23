import { pickedSlides, pickRange, pickToggle, toggledCurrent, type GridPick } from "@/editor/grid-selection"

export type SlidePress = "only" | "range" | "toggle" | "menu"

export type HeldSlides = { readonly anchor: string; readonly slides: ReadonlySet<string> } | null

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

export function heldOf(pick: GridPick, ids: readonly string[]): HeldSlides {
  if (pick === null) return null
  const slides = [...pick.slides].flatMap((index) => ids[index] ?? [])
  const anchor = ids[pick.anchor] ?? slides[0]
  return anchor === undefined ? null : { anchor, slides: new Set(slides) }
}

export function livePick(held: HeldSlides, current: number, ids: readonly string[]): GridPick {
  if (held === null) return null
  const slides = new Set(ids.flatMap((id, index) => (held.slides.has(id) ? [index] : [])))
  const anchor = ids.indexOf(held.anchor)
  const pick = several({ anchor: anchor === -1 ? Math.min(...slides) : anchor, slides })
  return pick?.slides.has(current) === true ? pick : null
}

export function heldSlides(pick: GridPick, current: number): readonly number[] {
  return pickedSlides(pick, current)
}

export function setDropPlace(held: readonly number[], index: number): number | null {
  if (held.includes(index)) return null
  return index > (held.at(-1) ?? index) ? index + 1 : index
}

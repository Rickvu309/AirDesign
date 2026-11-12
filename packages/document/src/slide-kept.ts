import { presentSlides, type SlideCommand, type SlideState } from "./slide-order.js"

export function slidesKept<S extends SlideState>(state: S, positions: readonly number[]): S {
  const chosen = new Set(positions)
  const present = presentSlides(state)
  if (!present.some((_, position) => chosen.has(position))) throw new Error("slides")
  const removed: SlideCommand[] = present
    .filter((_, position) => !chosen.has(position))
    .map((spot) => ({ slide: "remove", id: spot.id }))
  return removed.length === 0 ? state : { ...state, order: [...state.order, ...removed] }
}

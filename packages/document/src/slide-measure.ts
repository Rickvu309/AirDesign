import type { DeckIndex, SlideSize } from "./deck-index.js"
import { shapeOf, slideKind, type SlideId } from "./element-id.js"
import { floorOf } from "./slide-floor.js"
import type { SlideState } from "./slide-order.js"

export type SlideMeasure = {
  readonly size?: SlideSize
  readonly free: number
  readonly animated: readonly string[]
}

type Measured = SlideState & { readonly index?: DeckIndex }

function floorEnd(state: Measured, slide: SlideId): number {
  let end = 1
  for (const command of state.order) {
    if (!("id" in command) || command.id !== slide) continue
    for (const element of floorOf(command))
      if (slideKind(element.node) === null) end = Math.max(end, Number(shapeOf(element.node).shape))
  }
  return end + 1
}

function measureOf(
  state: Measured,
  slide: SlideId,
  depth: number,
): Pick<SlideMeasure, "free" | "animated"> | undefined {
  if (depth > state.order.length) return undefined
  const born = state.order.find(
    (command) => (command.slide === "add" || command.slide === "clone") && command.id === slide,
  )
  if (born?.slide === "add") return { free: floorEnd(state, slide), animated: [] }
  if (born?.slide === "clone") {
    const source = measureOf(state, born.source, depth + 1)
    return source === undefined
      ? undefined
      : { free: Math.max(source.free, floorEnd(state, slide)), animated: source.animated }
  }
  const row = state.index?.slides.find((each) => each.id === slide)
  return row?.free === undefined ? undefined : { free: row.free, animated: row.animated ?? [] }
}

export function slideMeasure(state: Measured, slide: SlideId): SlideMeasure | undefined {
  const size = state.index?.slides.find((row) => row.size !== undefined)?.size
  const measured = measureOf(state, slide, 0)
  return measured === undefined ? undefined : { ...(size === undefined ? {} : { size }), ...measured }
}

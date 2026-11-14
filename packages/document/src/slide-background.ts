import type { SlideId } from "./element-id.js"
import type { SlideState } from "./slide-order.js"
import { readRunColor, type RunColor } from "./text-value.js"

export type SlideBackground = {
  readonly slide: "background"
  readonly id: SlideId
  readonly color: RunColor | null
}

export function backgroundOf(state: Pick<SlideState, "order">, id: SlideId): RunColor | null {
  let color: RunColor | null = null
  for (const command of state.order) if (command.slide === "background" && command.id === id) color = command.color
  return color
}

export function sameColor(left: RunColor | null, right: RunColor | null): boolean {
  if (left === null || right === null) return left === right
  if ("scheme" in left) return "scheme" in right && left.scheme === right.scheme
  return "rgb" in right && left.rgb === right.rgb
}

export function readBackground(raw: Record<string, unknown>, id: SlideId): SlideBackground | undefined {
  if (raw.color === null) return { slide: "background", id, color: null }
  const color = readRunColor(raw.color)
  return color === null || color === undefined ? undefined : { slide: "background", id, color }
}

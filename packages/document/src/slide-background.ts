import type { SlideId } from "./element-id.js"
import type { SlideState } from "./slide-order.js"
import { readColor, type Color } from "./color.js"

export type SlideBackground = {
  readonly slide: "background"
  readonly id: SlideId
  readonly color: Color | null
}

export function backgroundOf(state: Pick<SlideState, "order">, id: SlideId): Color | null {
  let color: Color | null = null
  for (const command of state.order) if (command.slide === "background" && command.id === id) color = command.color
  return color
}

export function readBackground(raw: Record<string, unknown>, id: SlideId): SlideBackground | undefined {
  if (raw.color === null) return { slide: "background", id, color: null }
  const color = readColor(raw.color)
  return color === null || color === undefined ? undefined : { slide: "background", id, color }
}

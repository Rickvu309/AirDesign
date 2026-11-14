import type { SlideId } from "./element-id.js"
import { readColor, type Color } from "./color.js"

export type SlideBackground = {
  readonly slide: "background"
  readonly id: SlideId
  readonly color: Color | null
}

export function readBackground(raw: Record<string, unknown>, id: SlideId): SlideBackground | undefined {
  if (raw.color === null) return { slide: "background", id, color: null }
  const color = readColor(raw.color)
  return color === null || color === undefined ? undefined : { slide: "background", id, color }
}

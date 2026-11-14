import type { PaintEffects } from "@airdesign/pptx"
import type { CanvasEffects } from "@airdesign/render"
import { cssColor } from "@/paint-css"

export function canvasEffects(effects: PaintEffects | undefined): CanvasEffects | undefined {
  if (effects === undefined) return undefined
  const { glow, shadow, softEdge } = effects
  return {
    ...(shadow === undefined ? {} : { shadow: { ...shadow, color: cssColor(shadow.color) } }),
    ...(glow === undefined ? {} : { glow: { radius: glow.radius, color: cssColor(glow.color) } }),
    ...(softEdge === undefined ? {} : { softEdge }),
  }
}

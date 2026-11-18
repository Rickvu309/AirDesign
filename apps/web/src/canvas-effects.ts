import type { PaintEffects } from "@airdesign/pptx"
import type { CanvasEffects } from "@airdesign/render"
import { cssColor } from "@/paint-css"

export function canvasEffects(effects: PaintEffects | undefined): CanvasEffects | undefined {
  if (effects === undefined) return undefined
  const { blur, glow, innerShadow, shadow, softEdge } = effects
  return {
    ...(shadow === undefined ? {} : { shadow: { ...shadow, color: cssColor(shadow.color) } }),
    ...(innerShadow === undefined ? {} : { innerShadow: { ...innerShadow, color: cssColor(innerShadow.color) } }),
    ...(glow === undefined ? {} : { glow: { radius: glow.radius, color: cssColor(glow.color) } }),
    ...(softEdge === undefined ? {} : { softEdge }),
    ...(blur === undefined ? {} : { blur }),
  }
}

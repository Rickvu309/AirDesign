import type { PaintFill } from "@airdesign/pptx"
import type { PictureSource } from "@/picture-fill"
import { cssColor, fillOf } from "@/paint-css"

export function backgroundOf(fill: PaintFill | null, src: PictureSource): string | null {
  const painted = fillOf(fill, src)
  if (painted === null || fill?.type !== "picture" || fill.alpha === undefined) return painted
  const veil = cssColor({ hex: "ffffff", alpha: 1 - fill.alpha })
  return `linear-gradient(${veil}, ${veil}), ${painted}, white`
}

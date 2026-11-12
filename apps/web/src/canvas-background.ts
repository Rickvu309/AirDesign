import type { PaintFill } from "@airdesign/pptx"
import type { PictureSource } from "@/picture-fill"
import { fillOf } from "@/paint-css"

export function backgroundOf(fill: PaintFill | null, src: PictureSource): string | null {
  return fillOf(fill, src)
}

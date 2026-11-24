import type { Natural } from "./agent-draft.js"
import type { ImagePaint } from "./paint.js"

export type ImageCrop = NonNullable<ImagePaint["crop"]>
export type CropSides = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

const hundred = 100
const precision = 100_000
const smallest = 0.001

const tidy = (value: number) => Math.round(value * precision) / precision
const share = (cut: number) => Math.min(Math.max(cut / hundred, 0), 1 - smallest)

export function cropWindow(sides: CropSides): ImageCrop {
  const x = share(sides.left)
  const y = share(sides.top)
  const w = Math.max(smallest, 1 - x - share(sides.right))
  const h = Math.max(smallest, 1 - y - share(sides.bottom))
  return { x: tidy(x), y: tidy(y), w: tidy(Math.min(w, 1 - x)), h: tidy(Math.min(h, 1 - y)) }
}

const percent = (fraction: number) => Math.round(fraction * hundred * hundred) / hundred

export const cropSides = (crop: ImageCrop): CropSides => ({
  left: percent(crop.x),
  top: percent(crop.y),
  right: percent(1 - crop.x - crop.w),
  bottom: percent(1 - crop.y - crop.h),
})

export function coverCrop(frame: { readonly w: number; readonly h: number }, natural: Natural): ImageCrop {
  const frameShape = Math.max(1, frame.w) / Math.max(1, frame.h)
  const pictureShape = Math.max(1, natural.width) / Math.max(1, natural.height)
  if (pictureShape > frameShape) {
    const w = tidy(frameShape / pictureShape)
    return { x: tidy((1 - w) / 2), y: 0, w, h: 1 }
  }
  const h = tidy(pictureShape / frameShape)
  return { x: 0, y: tidy((1 - h) / 2), w: 1, h }
}

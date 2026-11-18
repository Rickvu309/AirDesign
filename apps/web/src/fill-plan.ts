import type { PaintColor, PaintElement, PaintFill, PaintInner, StackPaint } from "@airdesign/pptx"
import { pictureFrame, type PictureImage } from "@/picture-fill"

export type Placed =
  | { readonly tile: true }
  | { readonly tile: false; readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type PlanLayer =
  | { readonly kind: "color"; readonly color: PaintColor }
  | { readonly kind: "gradient"; readonly gradient: Extract<PaintFill, { type: "gradient" }> }
  | { readonly kind: "image"; readonly image: PictureImage; readonly placed: Placed }
  | { readonly kind: "inner"; readonly inner: PaintInner }

const whole = { width: 1, height: 1 }

function imageOf(row: PaintElement): PictureImage | null {
  return row.image ?? (row.fill?.type === "picture" ? row.fill : null)
}

function paintsOf(row: PaintElement): readonly StackPaint[] {
  if (row.stack !== undefined) return row.stack
  if (row.image === null) return row.fill === null ? [] : [row.fill]
  return [...(row.fill === null || row.fill.type === "picture" ? [] : [row.fill]), { type: "image" }]
}

function layerOf(paint: StackPaint, image: PictureImage | null): PlanLayer | null {
  if (paint.type === "solid") return { kind: "color", color: paint.color }
  if (paint.type === "pattern") return { kind: "color", color: paint.background }
  if (paint.type === "gradient") return { kind: "gradient", gradient: paint }
  const drawn = paint.type === "picture" ? paint : paint.type === "image" ? image : null
  if (drawn === null) return null
  if (drawn.tile) return { kind: "image", image: drawn, placed: { tile: true } }
  const frame = pictureFrame(drawn, whole)
  return frame === null ? null : { kind: "image", image: drawn, placed: { tile: false, ...frame } }
}

export function fillPlan(row: PaintElement): readonly PlanLayer[] {
  const image = imageOf(row)
  return paintsOf(row).flatMap((paint) => {
    const layer = layerOf(paint, image)
    return layer === null ? [] : [layer]
  })
}

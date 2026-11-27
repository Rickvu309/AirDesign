import type { Point } from "@/editing/slide-geometry"

export const sizeLabelHeight = 18
export const sizeLabelGap = 8

export function sizeLabelCentre(corners: readonly [Point, Point, Point, Point], middle: Point): Point {
  const base = { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 }
  const length = Math.hypot(base.x - middle.x, base.y - middle.y) || 1
  const by = sizeLabelGap + sizeLabelHeight / 2
  return {
    x: base.x + ((base.x - middle.x) / length) * by,
    y: base.y + ((base.y - middle.y) / length) * by,
  }
}

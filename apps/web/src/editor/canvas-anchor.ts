import type { Point } from "@/editing/slide-geometry"

export type ZoomAnchor = { readonly point: Point; readonly at: Point }

export function anchorOffset(
  stage: HTMLElement,
  paper: HTMLElement,
  held: ZoomAnchor,
  scale: number,
  pan: Point,
): Point {
  const rect = stage.getBoundingClientRect()
  const box = paper.getBoundingClientRect()
  return {
    x: pan.x + rect.left + held.at.x - (box.left + held.point.x * scale),
    y: pan.y + rect.top + held.at.y - (box.top + held.point.y * scale),
  }
}

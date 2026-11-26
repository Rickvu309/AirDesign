import type { Point } from "./slide-geometry"

export type ZoomAnchor = { readonly point: Point; readonly at: Point }

export function scrollToAnchor(stage: HTMLElement, paper: HTMLElement, held: ZoomAnchor, scale: number) {
  const rect = stage.getBoundingClientRect()
  const box = paper.getBoundingClientRect()
  stage.scrollLeft += box.left + held.point.x * scale - (rect.left + held.at.x)
  stage.scrollTop += box.top + held.point.y * scale - (rect.top + held.at.y)
}

import type { Box } from "@airdesign/document"
import type { Offset } from "./layer-copies.js"

type Size = { readonly width: number; readonly height: number }

function boundsOf(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.cx))
  const bottom = Math.max(...boxes.map((box) => box.y + box.cy))
  return { x: left, y: top, cx: right - left, cy: bottom - top }
}

function held(start: number, size: number, room: number): boolean {
  return start < room && start + size > 0
}

function centered(start: number, size: number, from: number, room: number): number {
  return Math.round(from + (room - size) / 2) - start
}

function meets(box: Box, view: Box): boolean {
  return box.x < view.x + view.cx && box.x + box.cx > view.x && box.y < view.y + view.cy && box.y + box.cy > view.y
}

export function pastedOffset(boxes: readonly Box[], slide: Size, view: Box | null): Offset {
  const bounds = boundsOf(boxes)
  if (bounds === null) return { dx: 0, dy: 0 }
  const dx = held(bounds.x, bounds.cx, slide.width) ? 0 : centered(bounds.x, bounds.cx, 0, slide.width)
  const dy = held(bounds.y, bounds.cy, slide.height) ? 0 : centered(bounds.y, bounds.cy, 0, slide.height)
  const placed = { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
  if (view === null || meets(placed, view)) return { dx, dy }
  return { dx: centered(bounds.x, bounds.cx, view.x, view.cx), dy: centered(bounds.y, bounds.cy, view.y, view.cy) }
}

export function pastedOver(boxes: readonly Box[], selected: readonly Box[]): Offset {
  const bounds = boundsOf(boxes)
  const over = boundsOf(selected)
  return bounds === null || over === null ? { dx: 0, dy: 0 } : { dx: over.x - bounds.x, dy: over.y - bounds.y }
}

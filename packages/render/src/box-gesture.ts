import type { Box, ElementId } from "@airdesign/document"
import type { PaintBox } from "./record.js"

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export type Grip = "move" | Corner

export type Point = { readonly x: number; readonly y: number }

export type Pull = {
  readonly grip: Grip
  readonly from: Point
  readonly start: Box
  readonly keepRatio?: boolean
  readonly rotation?: number
}

export type Drag = {
  readonly by: "pointer"
  readonly ids: readonly ElementId[]
  readonly grip: Grip
  readonly pointer: number
  readonly from: Point
  readonly starts: ReadonlyMap<ElementId, Box>
  readonly moved: boolean
  readonly keepRatio?: boolean
  readonly rotation?: number
  readonly enter?: ElementId
}

export type Nudge = {
  readonly by: "keys"
  readonly ids: readonly ElementId[]
  readonly starts: ReadonlyMap<ElementId, Box>
}

export type Held = Drag | Nudge

export type Moved = { readonly id: ElementId; readonly box: Box }

export type SlideSize = { readonly width: number; readonly height: number }

export const corners: readonly Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
export const minimumSide = 228_600
export const nudgeStep = 12_700
export const largeNudgeStep = 127_000
export const dragThreshold = 3

const arrows = new Map<string, Point>([
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowRight", { x: 1, y: 0 }],
  ["ArrowUp", { x: 0, y: -1 }],
  ["ArrowDown", { x: 0, y: 1 }],
])

const upright = { rotation: 0, flipH: false, flipV: false }

export function emuOf(pixels: number, width: number, slide: SlideSize): number {
  return Math.round((pixels * slide.width) / width)
}

function within(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest)
}

function placed(start: number, next: number, size: number, extent: number): number {
  const kept = Math.min(minimumSide, size)
  return within(next, Math.min(kept - size, start), Math.max(extent - kept, start))
}

export function movedBox(start: Box, dx: number, dy: number, slide: SlideSize): Box {
  return {
    x: placed(start.x, start.x + dx, start.cx, slide.width),
    y: placed(start.y, start.y + dy, start.cy, slide.height),
    cx: start.cx,
    cy: start.cy,
  }
}

function side(size: number, change: number): number {
  return Math.max(size + change, Math.min(minimumSide, size))
}

function ratioKept(start: Box, cx: number, cy: number): { readonly cx: number; readonly cy: number } {
  if (start.cx <= 0 || start.cy <= 0) return { cx, cy }
  const across = cx / start.cx
  const down = cy / start.cy
  const chosen = Math.abs(across - 1) >= Math.abs(down - 1) ? across : down
  const smallest = Math.min(1, minimumSide / Math.min(start.cx, start.cy))
  const scale = Math.max(chosen, smallest)
  return { cx: Math.round(start.cx * scale), cy: Math.round(start.cy * scale) }
}

function turned(point: Point, degrees: number): Point {
  const turn = (degrees * Math.PI) / 180
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

function uprightResize(start: Box, corner: Corner, dx: number, dy: number, keepRatio: boolean): Box {
  const left = corner === "top-left" || corner === "bottom-left"
  const top = corner === "top-left" || corner === "top-right"
  const free = { cx: side(start.cx, left ? -dx : dx), cy: side(start.cy, top ? -dy : dy) }
  const { cx, cy } = keepRatio ? ratioKept(start, free.cx, free.cy) : free
  return { x: left ? start.x + start.cx - cx : start.x, y: top ? start.y + start.cy - cy : start.y, cx, cy }
}

function turnedResize(start: Box, corner: Corner, dx: number, dy: number, keepRatio: boolean, rotation: number): Box {
  const upright = uprightResize(start, corner, dx, dy, keepRatio)
  if (rotation === 0) return upright
  const { cx, cy } = upright
  const across = corner === "top-left" || corner === "bottom-left" ? 1 : -1
  const down = corner === "top-left" || corner === "top-right" ? 1 : -1
  const kept = turned({ x: (across * start.cx) / 2, y: (down * start.cy) / 2 }, rotation)
  const next = turned({ x: (across * cx) / 2, y: (down * cy) / 2 }, rotation)
  return {
    x: Math.round(start.x + start.cx / 2 + kept.x - next.x - cx / 2),
    y: Math.round(start.y + start.cy / 2 + kept.y - next.y - cy / 2),
    cx,
    cy,
  }
}

export function resizedBox(start: Box, corner: Corner, dx: number, dy: number, keepRatio = false, rotation = 0): Box {
  const own = turned({ x: dx, y: dy }, -rotation)
  return turnedResize(start, corner, Math.round(own.x), Math.round(own.y), keepRatio, rotation)
}

export function frameOf(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((box) => box.x))
  const top = Math.min(...boxes.map((box) => box.y))
  const right = Math.max(...boxes.map((box) => box.x + box.cx))
  const bottom = Math.max(...boxes.map((box) => box.y + box.cy))
  return { x: left, y: top, cx: right - left, cy: bottom - top }
}

export function movedBoxes(
  starts: ReadonlyMap<ElementId, Box>,
  dx: number,
  dy: number,
  slide: SlideSize,
): ReadonlyMap<ElementId, Box> {
  const frame = frameOf([...starts.values()])
  if (frame === null) return starts
  const placedFrame = movedBox(frame, dx, dy, slide)
  const across = placedFrame.x - frame.x
  const down = placedFrame.y - frame.y
  return new Map([...starts].map(([id, start]) => [id, { ...start, x: start.x + across, y: start.y + down }]))
}

export function isArrow(key: string): boolean {
  return arrows.has(key)
}

export function nudgedBox(start: Box, key: string, large: boolean, slide: SlideSize): Box | null {
  const arrow = arrows.get(key)
  if (arrow === undefined) return null
  const step = large ? largeNudgeStep : nudgeStep
  return movedBox(start, arrow.x * step, arrow.y * step, slide)
}

export function nudgedBoxes(
  starts: ReadonlyMap<ElementId, Box>,
  key: string,
  large: boolean,
  slide: SlideSize,
): ReadonlyMap<ElementId, Box> | null {
  const arrow = arrows.get(key)
  if (arrow === undefined) return null
  const step = large ? largeNudgeStep : nudgeStep
  return movedBoxes(starts, arrow.x * step, arrow.y * step, slide)
}

export function resizedByKey(start: Box, key: string, rotation = 0): Box | null {
  const arrow = arrows.get(key)
  if (arrow === undefined) return null
  return turnedResize(start, "bottom-right", arrow.x * nudgeStep, arrow.y * nudgeStep, false, rotation)
}

export function draggedBox(gesture: Pull, at: Point, width: number, slide: SlideSize): Box {
  const dx = emuOf(at.x - gesture.from.x, width, slide)
  const dy = emuOf(at.y - gesture.from.y, width, slide)
  return gesture.grip === "move"
    ? movedBox(gesture.start, dx, dy, slide)
    : resizedBox(gesture.start, gesture.grip, dx, dy, gesture.keepRatio === true, gesture.rotation ?? 0)
}

export function draggedBoxes(drag: Drag, at: Point, width: number, slide: SlideSize): ReadonlyMap<ElementId, Box> {
  if (drag.grip === "move") {
    const dx = emuOf(at.x - drag.from.x, width, slide)
    const dy = emuOf(at.y - drag.from.y, width, slide)
    return movedBoxes(drag.starts, dx, dy, slide)
  }
  const [id] = drag.ids
  const start = id === undefined ? undefined : drag.starts.get(id)
  if (id === undefined || start === undefined) return new Map()
  return new Map([[id, draggedBox({ ...drag, start }, at, width, slide)]])
}

export function travelled(from: Point, at: Point): boolean {
  return Math.hypot(at.x - from.x, at.y - from.y) >= dragThreshold
}

export function boxOf(paint: PaintBox): Box {
  return {
    x: Math.round(paint.x),
    y: Math.round(paint.y),
    cx: Math.round(paint.width),
    cy: Math.round(paint.height),
  }
}

export function sameBox(left: Box | null, right: Box | null): boolean {
  if (left === null || right === null) return left === right
  return left.x === right.x && left.y === right.y && left.cx === right.cx && left.cy === right.cy
}

export function paintedAt(file: PaintBox | null, box: Box | null): PaintBox | null {
  if (box === null) return file
  return { ...(file ?? upright), x: box.x, y: box.y, width: box.cx, height: box.cy }
}

export function ownBox(element: { readonly box: PaintBox | null; readonly connection?: unknown }, box: Box | null) {
  return element.connection === undefined ? paintedAt(element.box, box) : element.box
}

export function followed(child: PaintBox | null, group: PaintBox | null, moved: Box | null): PaintBox | null {
  if (child === null || group === null || moved === null) return child
  const scaleX = group.width === 0 ? 1 : moved.cx / group.width
  const scaleY = group.height === 0 ? 1 : moved.cy / group.height
  return {
    ...child,
    x: moved.x + (child.x - group.x) * scaleX,
    y: moved.y + (child.y - group.y) * scaleY,
    width: child.width * scaleX,
    height: child.height * scaleY,
  }
}

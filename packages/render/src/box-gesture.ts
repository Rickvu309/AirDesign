import type { Box, ElementId } from "@airdesign/document"
import type { PaintBox } from "./record.js"
import { arrowOf } from "./gestures.js"

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export type Point = { readonly x: number; readonly y: number }

export type Nudge = {
  readonly by: "keys"
  readonly ids: readonly ElementId[]
  readonly starts: ReadonlyMap<ElementId, Box>
}

export type Moved = { readonly id: ElementId; readonly box: Box }

export type SlideSize = { readonly width: number; readonly height: number }

export const corners: readonly Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"]
export const keptOnSlide = 228_600
export const nudgeStep = 12_700
export const largeNudgeStep = 127_000
export const dragThreshold = 3

const upright = { rotation: 0, flipH: false, flipV: false }

export function emuOf(pixels: number, width: number, slide: SlideSize): number {
  return Math.round((pixels * slide.width) / width)
}

function within(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest)
}

function placed(start: number, next: number, size: number, extent: number): number {
  const kept = Math.min(keptOnSlide, size)
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

export function nudgedBox(start: Box, key: string, large: boolean, slide: SlideSize): Box | null {
  const arrow = arrowOf(key)
  if (arrow === null) return null
  const step = large ? largeNudgeStep : nudgeStep
  return movedBox(start, arrow.x * step, arrow.y * step, slide)
}

export function nudgedBoxes(
  starts: ReadonlyMap<ElementId, Box>,
  key: string,
  large: boolean,
  slide: SlideSize,
): ReadonlyMap<ElementId, Box> | null {
  const arrow = arrowOf(key)
  if (arrow === null) return null
  const step = large ? largeNudgeStep : nudgeStep
  return movedBoxes(starts, arrow.x * step, arrow.y * step, slide)
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

export function paintedAt(file: PaintBox | null, box: Box | null, rotation: number | null = null): PaintBox | null {
  if (box === null && rotation === null) return file
  if (box === null) return file === null ? null : { ...file, rotation: rotation ?? file.rotation }
  return {
    ...(file ?? upright),
    x: box.x,
    y: box.y,
    width: box.cx,
    height: box.cy,
    ...(rotation === null ? {} : { rotation }),
  }
}

export function ownBox(
  element: {
    readonly box: PaintBox | null
    readonly connection?: unknown
    readonly movable?: boolean
    readonly group?: { readonly frame?: unknown }
  },
  box: Box | null,
  rotation: number | null = null,
) {
  if (element.connection !== undefined) return element.box
  if (element.group !== undefined && element.group.frame === undefined && element.movable !== true) return element.box
  return paintedAt(element.box, box, rotation)
}

type Holder = { readonly box: PaintBox | null; readonly frame?: unknown }

export function memberAt(
  element: {
    readonly box: PaintBox | null
    readonly connection?: unknown
    readonly movable?: boolean
    readonly group?: Holder
    readonly nestedIn?: readonly Holder[]
  },
  own: Box | null,
  rotation: number | null,
  carried: Box | null,
  nestedCarried: readonly (Box | null)[] = [],
): PaintBox | null {
  const placed = ownBox(element, own, rotation)
  const group = element.group
  if (group === undefined || (own !== null && element.movable === true && group.frame === undefined)) return placed
  const holders = element.nestedIn ?? []
  const nested = holders.reduce(
    (child, holder, at) => followed(child, holder.box, nestedCarried[at] ?? null, holder.frame === undefined),
    placed,
  )
  return followed(nested, group.box, carried, group.frame === undefined)
}

export function followed(
  child: PaintBox | null,
  group: PaintBox | null,
  moved: Box | null,
  scales = true,
): PaintBox | null {
  if (child === null || group === null || moved === null) return child
  const scaleX = group.width === 0 || !scales ? 1 : moved.cx / group.width
  const scaleY = group.height === 0 || !scales ? 1 : moved.cy / group.height
  return {
    ...child,
    x: moved.x + (child.x - group.x) * scaleX,
    y: moved.y + (child.y - group.y) * scaleY,
    width: child.width * scaleX,
    height: child.height * scaleY,
  }
}

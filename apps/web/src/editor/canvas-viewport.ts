import { canvasInset } from "@/editor/canvas-zoom"

export type ScreenRect = {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export type ScreenPoint = { readonly x: number; readonly y: number }

export type WidthLimits = { readonly least: number; readonly most: number }

export type WheelLike = {
  readonly deltaX: number
  readonly deltaY: number
  readonly deltaMode: number
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

const wheelPixels = [1, 16, 800] as const

const wheelZoomStep = 10

const selectionMargin = 48

const zoomedReach = 64

export function wheelPixelsOf(event: WheelLike): ScreenPoint {
  const unit = wheelPixels[event.deltaMode] ?? 1
  return { x: event.deltaX * unit, y: event.deltaY * unit }
}

export function wheelZoomFactor(event: WheelLike): number {
  const step = Math.max(-wheelZoomStep, Math.min(wheelZoomStep, wheelPixelsOf(event).y))
  return Math.exp(-step * 0.01)
}

export function zoomedAbout(rect: ScreenRect, factor: number, point: ScreenPoint): ScreenRect {
  return {
    left: point.x - (point.x - rect.left) * factor,
    top: point.y - (point.y - rect.top) * factor,
    width: rect.width * factor,
    height: rect.height * factor,
  }
}

export function boundedFactor(width: number, factor: number, limits: WidthLimits): number {
  if (width <= 0) return 1
  return Math.min(limits.most, Math.max(limits.least, width * factor)) / width
}

export function selectionFactor(selection: ScreenRect, view: ScreenRect): number {
  const width = Math.max(1, selection.width)
  const height = Math.max(1, selection.height)
  return Math.min((view.width - 2 * selectionMargin) / width, (view.height - 2 * selectionMargin) / height)
}

export function centredAt(slide: ScreenRect, selection: ScreenRect, factor: number, centre: ScreenPoint): ScreenRect {
  const middle = { x: selection.left + selection.width / 2, y: selection.top + selection.height / 2 }
  const zoomed = zoomedAbout(slide, factor, middle)
  return { ...zoomed, left: zoomed.left + centre.x - middle.x, top: zoomed.top + centre.y - middle.y }
}

export function unionRect(rects: readonly ScreenRect[]): ScreenRect | null {
  if (rects.length === 0) return null
  const left = Math.min(...rects.map((rect) => rect.left))
  const top = Math.min(...rects.map((rect) => rect.top))
  const right = Math.max(...rects.map((rect) => rect.left + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height))
  return { left, top, width: right - left, height: bottom - top }
}

export function placedScroll(
  scroll: { readonly left: number; readonly top: number },
  laid: { readonly left: number; readonly top: number },
  wanted: { readonly left: number; readonly top: number },
): { left: number; top: number } {
  return { left: scroll.left + laid.left - wanted.left, top: scroll.top + laid.top - wanted.top }
}

export function stagePadding(
  view: { readonly width: number; readonly height: number },
  fit: boolean,
): { inline: number; block: number } | null {
  if (fit) return null
  return {
    inline: Math.max(canvasInset.side, view.width - zoomedReach),
    block: Math.max(canvasInset.gap, view.height - zoomedReach),
  }
}

export function viewCentre(view: ScreenRect): ScreenPoint {
  return { x: view.left + view.width / 2, y: view.top + view.height / 2 }
}

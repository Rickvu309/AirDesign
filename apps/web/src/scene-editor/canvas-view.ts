import { boundedZoom, zoomRanges } from "@/editor/canvas-zoom"

export type Size = { readonly w: number; readonly h: number }
export type Zoom = "fit" | number

export const roomInset = 64

const stops = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const

export function boundedScale(scale: number): number {
  return boundedZoom(scale * 100, zoomRanges.slides) / 100
}

export function fitScale(room: Size, slide: Size): number {
  if (slide.w <= 0 || slide.h <= 0) return 1
  const across = Math.max(1, room.w - 2 * roomInset) / slide.w
  const down = Math.max(1, room.h - 2 * roomInset) / slide.h
  return boundedScale(Math.min(across, down))
}

export function scaleOf(zoom: Zoom, room: Size, slide: Size): number {
  return zoom === "fit" ? fitScale(room, slide) : boundedScale(zoom)
}

export function steppedScale(scale: number, direction: 1 | -1): number {
  const found =
    direction === 1
      ? stops.find((stop) => stop > scale + 1e-6)
      : [...stops].reverse().find((stop) => stop < scale - 1e-6)
  return boundedScale(found ?? scale)
}

export function wheelScale(scale: number, deltaY: number): number {
  return boundedScale(scale * Math.exp(-deltaY * 0.01))
}

export function percentOf(scale: number): number {
  return Math.round(scale * 100)
}

export function scaleToFill(room: Size, frame: Size): number {
  if (frame.w <= 0 || frame.h <= 0) return 1
  return boundedScale(Math.min(Math.max(1, room.w - 96) / frame.w, Math.max(1, room.h - 96) / frame.h))
}

import { boundedZoom } from "@/editing/canvas-zoom"

export type Size = { readonly w: number; readonly h: number }
export type Zoom = "fit" | number

const stops = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const

export function boundedScale(scale: number): number {
  return boundedZoom(scale * 100) / 100
}

export function fitScale(room: Size, slide: Size): number {
  if (slide.w <= 0 || slide.h <= 0) return 1
  const width = Math.floor(Math.min(room.w, (room.h * slide.w) / slide.h))
  return boundedScale(Math.max(1, width) / slide.w)
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
  return boundedScale(Math.min(Math.max(1, room.w) / frame.w, Math.max(1, room.h) / frame.h))
}

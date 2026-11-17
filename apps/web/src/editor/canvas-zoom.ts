import { gestureFor } from "@airdesign/render"

export type SlideSize = { readonly width: number; readonly height: number }

export type Zoom = "fit" | number

export const zoomPresets = [50, 100, 200] as const

const zoomStops = [10, 25, 50, 75, 100, 150, 200, 300, 400] as const

export const zoomLimits = { least: 10, most: 400 } as const

const emuPerPixel = 9525

export function slideRoom(width: number): SlideSize {
  return { width, height: (width * 3) / 4 }
}

export const canvasInset = { side: 31, gap: 40 } as const

export function canvasRoom(canvas: SlideSize, overlay: number): SlideSize {
  return {
    width: Math.max(0, canvas.width - 2 * canvasInset.side),
    height: Math.max(0, canvas.height - overlay - 2 * canvasInset.gap),
  }
}

export function slideTop({ height, overlay, slide }: { height: number; overlay: number; slide: number }): number {
  return Math.max(canvasInset.gap, (height - overlay - slide) / 2)
}

export function fitWidth(room: SlideSize, slide: SlideSize): number {
  if (slide.width <= 0 || slide.height <= 0) return room.width
  return Math.floor(Math.min(room.width, (room.height * slide.width) / slide.height))
}

export function percentWidth(percent: number, slide: SlideSize): number {
  return Math.round(((slide.width / emuPerPixel) * percent) / 100)
}

export function zoomWidth(zoom: Zoom, room: SlideSize, slide: SlideSize): number {
  if (zoom === "fit") return fitWidth(room, slide)
  return percentWidth(zoom, slide)
}

export function zoomPercent(width: number, slide: SlideSize): number {
  if (slide.width <= 0) return 100
  return Math.round((width * emuPerPixel * 100) / slide.width)
}

export type ZoomKey = "in" | "out" | "fit" | "selection"

export function zoomKey(event: {
  readonly key: string
  readonly code?: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly field: boolean
}): ZoomKey | null {
  if (event.field) return null
  const gesture = gestureFor(event, "editor")
  if (gesture === "zoom-in") return "in"
  if (gesture === "zoom-out") return "out"
  if (gesture === "zoom-selection") return "selection"
  return gesture === "zoom-fit" ? "fit" : null
}

export function steppedZoom(direction: "in" | "out", percent: number): number {
  if (direction === "in") return zoomStops.find((stop) => stop > percent) ?? zoomLimits.most
  return [...zoomStops].reverse().find((stop) => stop < percent) ?? zoomLimits.least
}

export function typedZoom(text: string): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(text)
  if (match === null) return null
  const percent = Math.round(Number(match[1]))
  return Math.min(zoomLimits.most, Math.max(zoomLimits.least, percent))
}

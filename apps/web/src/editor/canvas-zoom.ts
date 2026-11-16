export type SlideSize = { readonly width: number; readonly height: number }

export type Zoom = "fit" | (typeof zoomSteps)[number]

export const zoomSteps = [50, 100, 200] as const

const emuPerPixel = 9525

export function slideRoom(width: number): SlideSize {
  return { width, height: (width * 3) / 4 }
}

const canvasInset = { side: 31, top: 85, bottom: 152 } as const

export function canvasRoom(canvas: SlideSize): SlideSize {
  return {
    width: Math.max(0, canvas.width - 2 * canvasInset.side),
    height: Math.max(0, canvas.height - canvasInset.top - canvasInset.bottom),
  }
}

export function fitWidth(room: SlideSize, slide: SlideSize): number {
  if (slide.width <= 0 || slide.height <= 0) return room.width
  return Math.floor(Math.min(room.width, (room.height * slide.width) / slide.height))
}

export function zoomWidth(zoom: Zoom, room: SlideSize, slide: SlideSize): number {
  if (zoom === "fit") return fitWidth(room, slide)
  return Math.round(((slide.width / emuPerPixel) * zoom) / 100)
}

export function zoomPercent(width: number, slide: SlideSize): number {
  if (slide.width <= 0) return 100
  return Math.round((width * emuPerPixel * 100) / slide.width)
}

export type ZoomKey = "in" | "out" | "fit"

export function zoomKey(event: {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly field: boolean
}): ZoomKey | null {
  if (event.field || event.altKey || !(event.metaKey || event.ctrlKey)) return null
  if (event.key === "=" || event.key === "+") return "in"
  if (event.key === "-" || event.key === "_") return "out"
  if (event.key === "0") return "fit"
  return null
}

export function steppedZoom(direction: "in" | "out", percent: number): Zoom {
  const first = zoomSteps[0]
  const last = zoomSteps[zoomSteps.length - 1] ?? first
  if (direction === "in") return zoomSteps.find((step) => step > percent) ?? last
  return [...zoomSteps].reverse().find((step) => step < percent) ?? first
}

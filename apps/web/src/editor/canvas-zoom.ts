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

import { useState } from "react"
import { percentWidth, zoomLimits, type SlideSize, type Zoom } from "@/editor/canvas-zoom"

export const gridGap = 32

export function gridLayout(percent: number, slide: SlideSize, count: number) {
  return { columns: gridColumns(count), width: percentWidth(percent, slide) }
}

function stored(deck: string): string {
  return `airdesign.grid-zoom.${deck}`
}

export function keptGridZoom(deck: string): Zoom {
  try {
    const value = localStorage.getItem(stored(deck))
    if (value === null || value === "fit") return "fit"
    return /^\d+(?:\.\d+)?$/.test(value) ? Math.min(zoomLimits.most, Math.max(zoomLimits.least, Number(value))) : "fit"
  } catch {
    return "fit"
  }
}

export function keepGridZoom(deck: string, zoom: Zoom): void {
  try {
    localStorage.setItem(stored(deck), String(zoom))
  } catch {
    return
  }
}

export function useKeptGridZoom(deck: string | null): [Zoom, (zoom: Zoom) => void] {
  const [zoom, setZoom] = useState(() => (deck === null ? "fit" : keptGridZoom(deck)))
  return [
    zoom,
    (next) => {
      if (deck !== null) keepGridZoom(deck, next)
      setZoom(next)
    },
  ]
}

export function gridColumns(count: number): number {
  return Math.min(10, Math.max(4, Math.ceil(Math.sqrt(count * 1.5))))
}

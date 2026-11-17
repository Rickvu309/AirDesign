import { defaultGrid1, slideId } from "@airdesign/document"
import { useState } from "react"
import { percentWidth, zoomLimits, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { readGridViewport, type GridViewport } from "@/editor/grid-viewport"

export function gridLayout(percent: number, slide: SlideSize, count: number) {
  return { columns: gridColumns(count), width: percentWidth(percent, slide) }
}

function stored(deck: string): string {
  return `airdesign.grid-zoom.${deck}`
}

function place(deck: string): string {
  return `airdesign.grid-viewport.${deck}`
}

export function keptGridViewport(deck: string | null): GridViewport | null {
  try {
    return deck === null ? null : readGridViewport(localStorage.getItem(place(deck)))
  } catch {
    return null
  }
}

export function keepGridViewport(deck: string | null, view: GridViewport | null): void {
  if (deck === null) return
  try {
    if (view === null) localStorage.removeItem(place(deck))
    else localStorage.setItem(place(deck), JSON.stringify(view))
  } catch {
    return
  }
}

export function keptGridZoom(deck: string): Zoom {
  try {
    const position = keptGridViewport(deck)
    if (position !== null) return position.scale * 100
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

export function useKeptGridZoom(deck: string | null): [Zoom, (zoom: Zoom, persist?: boolean) => void] {
  const [zoom, setZoom] = useState(() => (deck === null ? "fit" : keptGridZoom(deck)))
  return [
    zoom,
    (next, persist = true) => {
      if (persist && deck !== null) keepGridZoom(deck, next)
      setZoom(next)
    },
  ]
}

export function gridColumns(count: number): number {
  const file = Array.from({ length: count }, (_, index) => slideId(String(index + 1)))
  const second = defaultGrid1(file).starts[1]
  return second === undefined ? 4 : file.indexOf(second)
}

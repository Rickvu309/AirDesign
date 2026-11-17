import { useState } from "react"
import { percentWidth, typedZoom, type SlideSize, type Zoom } from "@/editor/canvas-zoom"

export const gridGap = 32

export const smallestThumb = 160

const rowGap = 24

const sectionGap = 32

const sectionHead = 36

const slideNumber = 24

export type GridRoom = { readonly width: number; readonly height: number }

export type GridLayout = { readonly columns: number; readonly width: number }

export type GridShape = {
  readonly counts: readonly number[]
  readonly heads: number
  readonly aspect: number
}

export function gridFit(room: number, size: number): GridLayout {
  const columns = Math.max(1, Math.floor((room + gridGap) / (size + gridGap)))
  const width = Math.max(0, Math.floor((room - gridGap * (columns - 1)) / columns))
  return { columns, width }
}

function rowsAt(counts: readonly number[], columns: number): number {
  return counts.reduce((rows, count) => rows + Math.ceil(count / columns), 0)
}

function deckHeight(shape: GridShape, columns: number, width: number): number {
  const rows = rowsAt(shape.counts, columns)
  const filled = shape.counts.filter((count) => count > 0).length
  return (
    rows * (Math.round(width * shape.aspect) + slideNumber) +
    (rows - filled) * rowGap +
    Math.max(0, shape.counts.length - 1) * sectionGap +
    shape.heads * sectionHead
  )
}

export function gridFitAll(room: GridRoom, shape: GridShape): GridLayout {
  const most = Math.max(0, ...shape.counts)
  let best = gridFit(room.width, smallestThumb)
  let widest = 0
  for (let columns = 1; columns <= most; columns += 1) {
    const across = Math.floor((room.width - gridGap * (columns - 1)) / columns)
    const rows = rowsAt(shape.counts, columns)
    const spare = room.height - deckHeight(shape, columns, 0)
    const down = Math.floor(spare / (rows * shape.aspect))
    const width = Math.min(across, down)
    if (width >= smallestThumb && width > widest) {
      best = { columns, width }
      widest = width
    }
  }
  return best
}

export function gridLayout(zoom: Zoom, room: GridRoom, slide: SlideSize, shape: GridShape): GridLayout {
  if (zoom === "fit") return gridFitAll(room, shape)
  const width = Math.min(room.width, percentWidth(zoom, slide))
  return { columns: Math.max(1, Math.floor((room.width + gridGap) / (width + gridGap))), width }
}

function stored(deck: string): string {
  return `airdesign.grid-zoom.${deck}`
}

export function keptGridZoom(deck: string): Zoom {
  try {
    const value = localStorage.getItem(stored(deck))
    if (value === null || value === "fit") return "fit"
    return /^\d+$/.test(value) ? (typedZoom(value) ?? "fit") : "fit"
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

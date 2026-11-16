import { useState } from "react"
import type { ZoomKey } from "@/editor/canvas-zoom"

export const gridSizes = [160, 220, 300, 420, 600] as const

export type GridSize = (typeof gridSizes)[number]

export const gridGap = 32

const middleSize: GridSize = 300

export function gridFit(room: number, size: number): { readonly columns: number; readonly width: number } {
  const columns = Math.max(1, Math.floor((room + gridGap) / (size + gridGap)))
  const width = Math.max(0, Math.floor((room - gridGap * (columns - 1)) / columns))
  return { columns, width }
}

export function steppedGridSize(key: ZoomKey, size: GridSize): GridSize {
  if (key === "fit") return middleSize
  const at = gridSizes.indexOf(size)
  const next = key === "in" ? at + 1 : at - 1
  return gridSizes[Math.min(Math.max(next, 0), gridSizes.length - 1)] ?? size
}

function stored(deck: string): string {
  return `airdesign.grid-size.${deck}`
}

export function keptGridSize(deck: string): GridSize {
  try {
    const value = localStorage.getItem(stored(deck))
    return gridSizes.find((size) => String(size) === value) ?? middleSize
  } catch {
    return middleSize
  }
}

export function keepGridSize(deck: string, size: GridSize): void {
  try {
    localStorage.setItem(stored(deck), String(size))
  } catch {
    return
  }
}

export function useKeptGridSize(deck: string | null): [GridSize, (size: GridSize) => void] {
  const [size, setSize] = useState(() => (deck === null ? middleSize : keptGridSize(deck)))
  return [
    size,
    (next) => {
      if (deck !== null) keepGridSize(deck, next)
      setSize(next)
    },
  ]
}

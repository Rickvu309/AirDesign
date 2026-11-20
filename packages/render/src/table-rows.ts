import type { ElementId } from "@airdesign/document"
import { useLayoutEffect, useSyncExternalStore, type RefObject } from "react"
import type { PaintBox } from "./paint-box.js"
import type { CanvasTable } from "./record.js"
import type { PaintStore } from "./store.js"
import type { Scaled } from "./text-look.js"

export type MeasuredRows = {
  readonly written: string
  readonly height: number
  readonly heights: readonly number[]
}

const tableGrid = "[data-canvas-table]"
const track = /^(\d+(?:\.\d+)?)px$/
const halfPixel = 0.5

function trackSizes(tracks: string): readonly number[] | null {
  const sizes = tracks.trim().split(/\s+/)
  return sizes.every((size) => track.test(size)) ? sizes.map((size) => Number.parseFloat(size)) : null
}

export function paintedRows(tracks: string, unit: number, own: readonly number[] = []): readonly number[] | null {
  const sizes = trackSizes(tracks)
  if (sizes === null || unit <= 0) return null
  return sizes.map((size, at) => {
    const kept = own[at]
    return kept !== undefined && Math.abs(size - kept * unit) <= halfPixel ? Math.round(kept) : Math.round(size / unit)
  })
}

export function ownRows(table: CanvasTable, height: number): readonly number[] {
  const rows = table.rows.map((row) => row.height)
  const down = table.frame?.height ?? rows.reduce((sum, row) => sum + row, 0)
  return down === 0 ? rows : rows.map((row) => (row * height) / down)
}

export function grownTable(box: PaintBox, rows: MeasuredRows | null): PaintBox {
  if (rows === null || Math.abs(rows.height - box.height) > 1) return box
  const painted = rows.heights.reduce((sum, height) => sum + height, 0)
  return painted > box.height ? { ...box, height: painted } : box
}

export function sameRows(left: MeasuredRows | null, right: MeasuredRows | null): boolean {
  if (left === null || right === null) return left === right
  return (
    left.written === right.written &&
    left.height === right.height &&
    left.heights.length === right.heights.length &&
    left.heights.every((height, at) => height === right.heights[at])
  )
}

function gridIn(holder: HTMLElement | null): HTMLElement | null {
  return holder?.querySelector<HTMLElement>(tableGrid) ?? null
}

function tracksOf(grid: HTMLElement): string {
  return grid.ownerDocument.defaultView?.getComputedStyle(grid).gridTemplateRows ?? ""
}

export function rowFloors(holder: HTMLElement | null): readonly number[] | null {
  const grid = gridIn(holder)
  if (grid === null) return null
  const kept = grid.style.gridTemplateRows
  const count = kept.split("minmax(").length - 1
  grid.style.gridTemplateRows = Array.from({ length: count }, () => "min-content").join(" ")
  const floors = trackSizes(tracksOf(grid))
  grid.style.gridTemplateRows = kept
  return floors
}

export function useMeasuredRows(
  store: PaintStore,
  id: ElementId,
  holder: RefObject<HTMLElement | null>,
  written: string,
  height: number | undefined,
  scaled: Scaled,
  table: CanvasTable,
): void {
  useLayoutEffect(() => {
    const grid = gridIn(holder.current)
    if (grid === null || height === undefined) return
    const own = ownRows(table, height)
    const measure = () => {
      const heights = paintedRows(tracksOf(grid), scaled(1), own)
      store.placeRows(id, heights === null ? null : { written, height, heights })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const watch = new ResizeObserver(measure)
    watch.observe(grid)
    return () => watch.disconnect()
  }, [store, id, holder, written, height, scaled, table])
}

export function useRows(store: PaintStore, id: ElementId): MeasuredRows | null {
  return useSyncExternalStore(
    store.boxSubscribe(id),
    () => store.getRows(id),
    () => store.getRows(id),
  )
}

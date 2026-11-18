import type { PaintBox } from "@airdesign/render"
import { zoomRanges } from "./canvas-zoom"

export type GridViewport = { readonly x: number; readonly y: number; readonly scale: number }

export function zoomedGrid(
  view: GridViewport,
  scale: number,
  anchor: { readonly x: number; readonly y: number },
): GridViewport {
  const ratio = scale / view.scale
  return { x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, scale }
}

export type GridBounds = { readonly width: number; readonly height: number }
type GridRect = GridBounds & { readonly left: number; readonly top: number }
type GridDelta = { readonly x: number; readonly y: number }

export function pannedGrid(view: GridViewport, delta: GridDelta): GridViewport {
  return { ...view, x: view.x + delta.x, y: view.y + delta.y }
}

export function boundedGridScale(scale: number): number {
  return Math.max(zoomRanges.grid.least / 100, Math.min(zoomRanges.grid.most / 100, scale))
}

export function fittedGrid(bounds: GridBounds, room: GridBounds): GridViewport {
  const scale = boundedGridScale(
    Math.min((room.width - 96) / Math.max(1, bounds.width), (room.height - 96) / Math.max(1, bounds.height)),
  )
  return { x: (room.width - bounds.width * scale) / 2, y: (room.height - bounds.height * scale) / 2, scale }
}

export function revealedGrid(view: GridViewport, box: GridRect, room: GridRect): GridViewport {
  function delta(start: number, size: number, edge: number, length: number) {
    if (size > length - 48) return edge + (length - size) / 2 - start
    if (start < edge + 24) return edge + 24 - start
    if (start + size > edge + length - 24) return edge + length - 24 - start - size
    return 0
  }
  return pannedGrid(view, {
    x: delta(box.left, box.width, room.left, room.width),
    y: delta(box.top, box.height, room.top, room.height),
  })
}

export function gridSpacing(width: number, height: number) {
  return { column: width * 0.13, row: height * 0.57 }
}

const wheelPixels = [1, 16, 800] as const

const wheelZoomStep = 10

export function wheeledGrid(
  view: GridViewport,
  event: {
    readonly deltaX: number
    readonly deltaY: number
    readonly deltaMode: number
    readonly shiftKey: boolean
    readonly ctrlKey: boolean
    readonly metaKey: boolean
  },
  anchor: GridDelta,
): GridViewport {
  const unit = wheelPixels[event.deltaMode] ?? 1
  const x = event.deltaX * unit
  const y = event.deltaY * unit
  if (event.ctrlKey || event.metaKey) {
    const step = Math.max(-wheelZoomStep, Math.min(wheelZoomStep, y))
    const next = view.scale * Math.exp(-step * 0.01)
    return zoomedGrid(view, boundedGridScale(next), anchor)
  }
  return pannedGrid(view, event.shiftKey && x === 0 ? { x: -y, y: 0 } : { x: -x, y: -y })
}

export function gridScaleMoved(view: GridViewport, scale: number): boolean {
  return Math.abs(view.scale - scale) > view.scale * 1e-9
}

export function arrowGrid(view: GridViewport, key: string): GridViewport {
  const x = key === "ArrowLeft" ? 80 : key === "ArrowRight" ? -80 : 0
  const y = key === "ArrowUp" ? 80 : key === "ArrowDown" ? -80 : 0
  return pannedGrid(view, { x, y })
}

export function readGridViewport(raw: string | null): GridViewport | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== "object" || value === null || !("x" in value) || !("y" in value) || !("scale" in value))
      return null
    const { x, y, scale } = value
    return typeof x === "number" &&
      Number.isFinite(x) &&
      typeof y === "number" &&
      Number.isFinite(y) &&
      typeof scale === "number" &&
      Number.isFinite(scale) &&
      scale === boundedGridScale(scale)
      ? { x, y, scale }
      : null
  } catch {
    return null
  }
}

export function gridSectionGap(scale: number): number {
  return 32 / scale
}

export type GridGeometry = {
  readonly rows: readonly { readonly start: number; readonly end: number }[]
  readonly sections: readonly number[]
  readonly width: number
  readonly height: number
}

const sectionPixels = 44

function sectionRows(geometry: GridGeometry, rows: GridGeometry["rows"]): number {
  return rows.filter((row) => geometry.sections.some((start) => start >= row.start && start < row.end)).length
}

function gridCard(geometry: GridGeometry, index: number) {
  const { rows, width, height } = geometry
  const number = rows.findIndex((row) => index >= row.start && index < row.end)
  const row = rows[number]
  if (row === undefined) return null
  const spacing = gridSpacing(width, height)
  return {
    left: (index - row.start) * (width + spacing.column),
    top: number * (height + 24 + spacing.row),
    fixed: sectionRows(geometry, rows.slice(0, number + 1)) * sectionPixels,
  }
}

export function fittedGridCards(
  geometry: GridGeometry,
  indices: readonly number[],
  room: GridBounds,
): GridViewport | null {
  const cards = indices.flatMap((index) => gridCard(geometry, index) ?? [])
  if (cards.length === 0) return null
  const left = Math.min(...cards.map((card) => card.left))
  const top = Math.min(...cards.map((card) => card.top))
  const fixed = Math.min(...cards.map((card) => card.fixed))
  const bounds = {
    width: Math.max(...cards.map((card) => card.left)) - left + geometry.width,
    height: Math.max(...cards.map((card) => card.top)) - top + geometry.height + 24,
  }
  const fit = fittedGrid(bounds, {
    width: room.width,
    height: room.height - Math.max(...cards.map((card) => card.fixed)) + fixed,
  })
  return { x: fit.x - left * fit.scale, y: fit.y - top * fit.scale - fixed, scale: fit.scale }
}

type ElementBox = Pick<PaintBox, "x" | "y" | "width" | "height" | "rotation">

function rotatedBox(box: ElementBox): GridRect {
  const angle = (box.rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  const width = box.width * cos + box.height * sin
  const height = box.width * sin + box.height * cos
  return { left: box.x + (box.width - width) / 2, top: box.y + (box.height - height) / 2, width, height }
}

export function fittedGridElements(
  geometry: GridGeometry,
  index: number,
  elements: readonly ElementBox[],
  slideWidth: number,
  room: GridBounds,
): GridViewport | null {
  const card = gridCard(geometry, index)
  if (card === null || elements.length === 0 || slideWidth <= 0) return null
  const boxes = elements.map(rotatedBox)
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const unit = geometry.width / slideWidth
  const fit = fittedGrid(
    {
      width: (Math.max(...boxes.map((box) => box.left + box.width)) - left) * unit,
      height: (Math.max(...boxes.map((box) => box.top + box.height)) - top) * unit,
    },
    room,
  )
  return {
    x: fit.x - (card.left + left * unit) * fit.scale,
    y: fit.y - (card.top + 24 + top * unit) * fit.scale - card.fixed,
    scale: fit.scale,
  }
}

export function fittedGridRows(geometry: GridGeometry, room: GridBounds): GridViewport {
  const { rows, width, height } = geometry
  const spacing = gridSpacing(width, height)
  const columns = Math.max(1, ...rows.map((row) => row.end - row.start))
  const bounds = {
    width: columns * width + (columns - 1) * spacing.column,
    height: rows.length * (height + 24) + Math.max(0, rows.length - 1) * spacing.row,
  }
  const heads = sectionRows(geometry, rows) * sectionPixels
  const scale = boundedGridScale(
    Math.min((room.width - 96) / bounds.width, (room.height - 96 - heads) / Math.max(1, bounds.height)),
  )
  return { x: (room.width - bounds.width * scale) / 2, y: (room.height - bounds.height * scale - heads) / 2, scale }
}

export function resizedGrid(view: GridViewport, box: GridRect, before: GridRect, after: GridRect): GridViewport {
  const inside = (room: GridRect) =>
    box.left >= room.left &&
    box.top >= room.top &&
    box.left + box.width <= room.left + room.width &&
    box.top + box.height <= room.top + room.height
  if (!inside(before) || inside(after)) return view
  const delta = (start: number, size: number, edge: number, length: number) =>
    size > length
      ? edge + (length - size) / 2 - start
      : Math.max(edge - start, Math.min(0, edge + length - start - size))
  return pannedGrid(view, {
    x: delta(box.left, box.width, after.left, after.width),
    y: delta(box.top, box.height, after.top, after.height),
  })
}

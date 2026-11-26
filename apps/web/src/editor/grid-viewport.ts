import { arrowOf } from "@/lib/gestures"
import { zoomRanges } from "@/editing/canvas-zoom"
import type { GridLayout, GridRect, GridSize } from "@/editor/grid-lines"

export type GridView = { readonly x: number; readonly y: number; readonly scale: number }
export type GridCamera = "fit" | GridView

type GridPoint = { readonly x: number; readonly y: number }

export type WheelLike = {
  readonly deltaX: number
  readonly deltaY: number
  readonly deltaMode: number
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

const fitPadding = 48
const revealMargin = 24
const arrowStep = 80
const wheelPixels = [1, 16, 800] as const
const wheelZoomStep = 10

export function boundedGridScale(scale: number): number {
  return Math.max(zoomRanges.grid.least / 100, Math.min(zoomRanges.grid.most / 100, scale))
}

export function zoomedGrid(view: GridView, scale: number, anchor: GridPoint): GridView {
  const ratio = scale / view.scale
  return { x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, scale }
}

export function zoomedGridBy(view: GridView, factor: number, anchor: GridPoint): GridView {
  return zoomedGrid(view, boundedGridScale(view.scale * factor), anchor)
}

export function pannedGrid(view: GridView, delta: GridPoint): GridView {
  return { ...view, x: view.x + delta.x, y: view.y + delta.y }
}

function wheelPixelsOf(event: WheelLike): GridPoint {
  const unit = wheelPixels[event.deltaMode] ?? 1
  return { x: event.deltaX * unit, y: event.deltaY * unit }
}

export function wheeledGrid(view: GridView, event: WheelLike, anchor: GridPoint): GridView {
  const { x, y } = wheelPixelsOf(event)
  if (event.ctrlKey || event.metaKey) {
    const step = Math.max(-wheelZoomStep, Math.min(wheelZoomStep, y))
    return zoomedGridBy(view, Math.exp(-step * 0.01), anchor)
  }
  return pannedGrid(view, event.shiftKey && x === 0 ? { x: -y, y: 0 } : { x: -x, y: -y })
}

export function arrowGrid(view: GridView, key: string): GridView {
  const arrow = arrowOf(key)
  return arrow === null ? view : pannedGrid(view, { x: -arrowStep * arrow.x, y: -arrowStep * arrow.y })
}

export function readGridViewport(raw: string | null): GridView | null {
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

export function fittedGrid(block: GridSize, room: GridSize): GridView {
  const scale = boundedGridScale(
    Math.min(
      (room.width - 2 * fitPadding) / Math.max(1, block.width),
      (room.height - 2 * fitPadding) / Math.max(1, block.height),
    ),
  )
  return { x: (room.width - block.width * scale) / 2, y: (room.height - block.height * scale) / 2, scale }
}

export function fittedGridCards(layout: GridLayout, indices: readonly number[], room: GridSize): GridView | null {
  const cards = layout.cards.filter((card) => indices.includes(card.index))
  if (cards.length === 0) return null
  const inset = layout.cards[0]?.top ?? 0
  const left = Math.min(...cards.map((card) => card.left))
  const top = Math.min(...cards.map((card) => card.top)) - inset
  const right = Math.max(...cards.map((card) => card.left + card.width))
  const bottom = Math.max(...cards.map((card) => card.top + card.height))
  const fit = fittedGrid({ width: right - left, height: bottom - top }, room)
  return { x: fit.x - left * fit.scale, y: fit.y - top * fit.scale, scale: fit.scale }
}

export function revealedGrid(view: GridView, box: GridRect, room: GridRect): GridView {
  function delta(start: number, size: number, edge: number, length: number) {
    if (size > length - 2 * revealMargin) return edge + (length - size) / 2 - start
    if (start < edge + revealMargin) return edge + revealMargin - start
    if (start + size > edge + length - revealMargin) return edge + length - revealMargin - start - size
    return 0
  }
  const x = delta(box.left, box.width, room.left, room.width)
  const y = delta(box.top, box.height, room.top, room.height)
  return x === 0 && y === 0 ? view : pannedGrid(view, { x, y })
}

function exposedGrid(view: GridView, box: GridRect, room: GridRect): GridView {
  const delta = (start: number, size: number, edge: number, length: number) =>
    size > length ? edge - start : Math.max(edge - start, Math.min(0, edge + length - start - size))
  const x = delta(box.left, box.width, room.left, room.width)
  const y = delta(box.top, box.height, room.top, room.height)
  return x === 0 && y === 0 ? view : pannedGrid(view, { x, y })
}

function fullyInside(start: number, size: number, edge: number, length: number): boolean {
  const epsilon = 0.02
  return start >= edge - epsilon && start + size <= edge + length + epsilon
}

export function resizedGrid(view: GridView, box: GridRect, before: GridRect, after: GridRect): GridView {
  if (!fullyInside(box.left, box.width, before.left, before.width)) return view
  const available = after.width - 2 * fitPadding
  const scale =
    box.width > after.width && available > 0 && view.scale > 0
      ? Math.min(view.scale, boundedGridScale(available / (box.width / view.scale)))
      : view.scale
  if (scale < view.scale) {
    const worldLeft = (box.left - after.left - view.x) / view.scale
    const centre = box.top + box.height / 2
    const worldCentre = (centre - after.top - view.y) / view.scale
    return { x: fitPadding - worldLeft * scale, y: centre - after.top - worldCentre * scale, scale }
  }
  const panned = exposedGrid(view, box, after)
  if (fullyInside(box.top, box.height, before.top, before.height) || panned.y === view.y) return panned
  return panned.x === view.x ? view : { x: panned.x, y: view.y, scale: view.scale }
}

export function cardBox(layout: GridLayout, view: GridView, index: number): GridRect | null {
  const card = layout.cards[index]
  if (card === undefined) return null
  return {
    left: view.x + card.left * view.scale,
    top: view.y + card.top * view.scale,
    width: card.width * view.scale,
    height: card.height * view.scale,
  }
}

export function keptGridShows(
  camera: GridCamera,
  layout: GridLayout,
  room: GridSize,
  focus: number | undefined,
): GridCamera {
  if (camera === "fit" || room.width === 0 || room.height === 0 || gridShown(layout, camera, room, 0).length > 0)
    return camera
  const box = focus === undefined ? null : cardBox(layout, camera, focus)
  return box === null ? "fit" : revealedGrid(camera, box, { left: 0, top: 0, ...room })
}

export const gridPaintMargin = 200

export function gridShown(layout: GridLayout, view: GridView, room: GridSize, margin: number): readonly number[] {
  return layout.cards
    .filter((card) => {
      const left = view.x + card.left * view.scale
      const top = view.y + card.top * view.scale
      return (
        left < room.width + margin &&
        left + card.width * view.scale > -margin &&
        top < room.height + margin &&
        top + card.height * view.scale > -margin
      )
    })
    .map((card) => card.index)
}

import type { PaintBox } from "@airdesign/render"
import { gridElementPresses } from "./grid-number"
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
  return fitGridBounds(bounds, room, 0, () => ({ left: 0, right: 0 }))
}

export function revealedGrid(view: GridViewport, box: GridRect, room: GridRect, keepLeft = false): GridViewport {
  function delta(start: number, size: number, edge: number, length: number) {
    if (size > length - 48) return edge + (length - size) / 2 - start
    if (start < edge + 24) return edge + 24 - start
    if (start + size > edge + length - 24) return edge + length - 24 - start - size
    return 0
  }
  return pannedGrid(view, {
    x:
      keepLeft && box.width > room.width - 48
        ? room.left + 24 - box.left
        : delta(box.left, box.width, room.left, room.width),
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
  readonly rowHandles?: boolean
  readonly width: number
  readonly height: number
}

export const gridSectionHeight = 44

function sectionRows(geometry: GridGeometry, rows: GridGeometry["rows"]): number {
  return rows.filter((row) => geometry.sections.some((start) => start >= row.start && start < row.end)).length
}

export function gridScreenFixed(geometry: GridGeometry, index: number): number {
  return gridCard(geometry, index)?.fixed ?? 0
}

function gridCard(geometry: GridGeometry, index: number) {
  const { rows, width, height } = geometry
  const number = rows.findIndex((row) => index >= row.start && index < row.end)
  const row = rows[number]
  if (row === undefined) return null
  const spacing = gridSpacing(width, height)
  return {
    left: (index - row.start) * (width + spacing.column),
    leading: index === row.start,
    trailing: index === row.end - 1,
    top: number * (height + 24 + spacing.row),
    fixed: sectionRows(geometry, rows.slice(0, number + 1)) * gridSectionHeight,
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
  const right = Math.max(...cards.map((card) => card.left))
  const bounds = {
    width: right - left + geometry.width,
    height: Math.max(...cards.map((card) => card.top)) - top + geometry.height + 24,
  }
  const leading = cards.some((card) => card.leading)
  const trailing = cards.some((card) => card.trailing && card.left === right)
  const heads = Math.max(...cards.map((card) => card.fixed)) - fixed
  const fit = fitGridBounds(bounds, room, heads, (scale) => rowChrome(geometry, scale, leading, trailing))
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

export function gridElementBounds(elements: readonly ElementBox[], unit: number): GridRect | null {
  if (elements.length === 0 || unit <= 0) return null
  const boxes = elements.map(rotatedBox)
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  return {
    left: left * unit,
    top: top * unit,
    width: (Math.max(...boxes.map((box) => box.left + box.width)) - left) * unit,
    height: (Math.max(...boxes.map((box) => box.top + box.height)) - top) * unit,
  }
}

export function fittedGridElements(
  geometry: GridGeometry,
  index: number,
  elements: readonly ElementBox[],
  slideWidth: number,
  room: GridBounds,
): GridViewport | null {
  const card = gridCard(geometry, index)
  const bounds = slideWidth > 0 ? gridElementBounds(elements, geometry.width / slideWidth) : null
  if (card === null || bounds === null) return null
  const fit = fittedGrid(bounds, room)
  return {
    x: fit.x - (card.left + bounds.left) * fit.scale,
    y: fit.y - (card.top + 24 + bounds.top) * fit.scale - card.fixed,
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
  const heads = sectionRows(geometry, rows) * gridSectionHeight
  return fitGridBounds(bounds, room, heads, (scale) => rowChrome(geometry, scale, true, true))
}

export const gridRowHandle = { offset: 32, width: 28, minimumHeight: 80 }

function rowChrome(bounds: GridGeometry, scale: number, leading: boolean, trailing: boolean) {
  const gap = gridSpacing(bounds.width, bounds.height).column * scale
  return {
    left:
      leading && bounds.rowHandles !== false && bounds.height * scale >= gridRowHandle.minimumHeight
        ? gridRowHandle.offset + gridRowHandle.width / 2
        : 0,
    right: trailing && gridElementPresses({ width: bounds.width * scale, gap }) ? gap / 2 + 4 : 0,
  }
}

export function gridCardBounds(
  geometry: GridGeometry,
  index: number,
  scale: number,
  box: GridRect,
  trailingMargin = 0,
): GridRect {
  const row = geometry.rows.find((row) => index >= row.start && index < row.end)
  const chrome = rowChrome(geometry, scale, index === row?.start, index === (row?.end ?? 0) - 1)
  return {
    left: box.left - chrome.left,
    top: box.top,
    width: box.width + chrome.left + Math.max(0, chrome.right - trailingMargin),
    height: box.height,
  }
}

const fitPadding = 48

function fitGridBounds(
  bounds: GridBounds,
  room: GridBounds,
  heads: number,
  chrome: (scale: number) => { left: number; right: number },
): GridViewport {
  const available = room.width - 2 * fitPadding
  const widest = Math.max(1, bounds.width)
  let scale = boundedGridScale(
    Math.min(available / widest, (room.height - 2 * fitPadding - heads) / Math.max(1, bounds.height)),
  )
  const fits = (at: number) => {
    const { left, right } = chrome(at)
    return widest * at + left + right <= available
  }
  if (!fits(scale)) {
    let high = scale
    scale = zoomRanges.grid.least / 100
    for (let i = 0; i < 32; i++) {
      const middle = (scale + high) / 2
      if (fits(middle)) scale = middle
      else high = middle
    }
  }
  const { left, right } = chrome(scale)
  return {
    x: (room.width - bounds.width * scale + left - right) / 2,
    y: (room.height - bounds.height * scale - heads) / 2,
    scale,
  }
}

export function gridHeadingEdge(width: number, view: GridViewport, fit: boolean): number {
  return width - view.x - (fit ? fitPadding : 0)
}

export function exposedGrid(view: GridViewport, box: GridRect, room: GridRect): GridViewport {
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

export function resizedGrid(
  view: GridViewport,
  box: GridRect,
  before: GridRect,
  after: GridRect,
  fixed = 0,
): GridViewport {
  if (!fullyInside(box.left, box.width, before.left, before.width)) return view
  const available = after.width - 2 * fitPadding
  const scale =
    box.width > after.width && available > 0 && view.scale > 0
      ? Math.min(view.scale, boundedGridScale(available / (box.width / view.scale)))
      : view.scale
  if (scale < view.scale) {
    const worldLeft = (box.left - after.left - view.x) / view.scale
    const centre = box.top + box.height / 2
    const worldCentre = (centre - after.top - view.y - fixed) / view.scale
    return { x: fitPadding - worldLeft * scale, y: centre - after.top - fixed - worldCentre * scale, scale }
  }
  const panned = exposedGrid(view, box, after)
  if (fullyInside(box.top, box.height, before.top, before.height) || panned.y === view.y) return panned
  return panned.x === view.x ? view : { x: panned.x, y: view.y, scale: view.scale }
}

export function gridThumbHeight(width: number, height: number, reference: number): number {
  return height <= 0 ? Math.round((width * 9) / 16) : Math.round((height * width) / reference)
}

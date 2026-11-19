import type { PaintBox } from "@airdesign/render"
import { gridElementPresses } from "./grid-number"
import { zoomRanges } from "./canvas-zoom"
import { wheelPixelsOf, wheelZoomFactor, type WheelLike } from "./canvas-viewport"
import { gridCardInset, gridLineGap, gridVisualLines, gridWrapColumns } from "./grid-lines"

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

const fitPadding = 48

export function fittedGrid(bounds: GridBounds, room: GridBounds): GridViewport {
  return fitGridBounds(
    bounds.width,
    (scale) => bounds.height * scale,
    room,
    () => ({ left: 0, right: 0 }),
    (room.height - 2 * fitPadding) / Math.max(1, bounds.height),
  )
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
  return { column: width * 0.13, line: height * 0.57 }
}

export function wheeledGrid(view: GridViewport, event: WheelLike, anchor: GridDelta): GridViewport {
  if (event.ctrlKey || event.metaKey) {
    return zoomedGrid(view, boundedGridScale(view.scale * wheelZoomFactor(event)), anchor)
  }
  const { x, y } = wheelPixelsOf(event)
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

export type GridGeometry = {
  readonly groups: readonly { readonly start: number; readonly end: number }[]
  readonly groupHandles?: boolean
  readonly width: number
  readonly height: number
}

export function gridTracks({ groups }: GridGeometry) {
  return groups.flatMap(({ start, end }, number) => {
    const cards = Array.from({ length: end - start }, (_, offset) => start + offset)
    return cards.length === 0 ? [] : [{ start, end, number, cards }]
  })
}

type GridTrack = ReturnType<typeof gridTracks>[number]

export function gridLayoutLines(geometry: GridGeometry): GridTrack[] {
  const count = geometry.groups.at(-1)?.end ?? 0
  return gridVisualLines(gridTracks(geometry), gridWrapColumns(count, geometry.groups))
}

export function gridColumnCount(geometry: GridGeometry): number {
  return Math.max(1, ...gridLayoutLines(geometry).map(gridTrackColumns))
}

export function gridTrackGap(
  geometry: GridGeometry,
  lines: readonly { readonly number: number }[],
  index: number,
): number {
  const next = lines[index + 1]
  const line = lines[index]
  if (next === undefined || line === undefined) return 0
  const spacing = gridSpacing(geometry.width, geometry.height)
  if (next.number === line.number) return gridLineGap(spacing.line, spacing.column)
  return spacing.line
}

export function gridTrackColumns(track: GridTrack): number {
  return Math.max(...track.cards) - track.start + 1
}

export function gridTrackSize(track: GridTrack, geometry: GridGeometry, gap: number) {
  return {
    world: track.cards.length > 0 ? geometry.height + gridCardInset + gap : 0,
    fixed: 0,
  }
}

function gridTrackSizes(geometry: GridGeometry, lines: readonly GridTrack[]) {
  return lines.map((line, index) => gridTrackSize(line, geometry, gridTrackGap(geometry, lines, index)))
}

export function gridScreenFixed(geometry: GridGeometry, index: number): number {
  return gridCard(geometry, index)?.fixed ?? 0
}

function gridCard(geometry: GridGeometry, index: number) {
  const lines = gridLayoutLines(geometry)
  const number = lines.findIndex((line) => line.cards.includes(index))
  const line = lines[number]
  if (line === undefined) return null
  const { width, height } = geometry
  const preceding = gridTrackSizes(geometry, lines).slice(0, number)
  return {
    left: (index - line.start) * (width + gridSpacing(width, height).column),
    leading: index === line.cards[0] && line.cards.length === line.end - line.start,
    trailing: index === line.cards.at(-1),
    top: preceding.reduce((total, group) => total + group.world, 0),
    fixed: 0,
  }
}

export function fittedGridCards(
  geometry: GridGeometry,
  indices: readonly number[],
  room: GridBounds,
): GridViewport | null {
  const placed = () => indices.flatMap((index) => gridCard(geometry, index) ?? [])
  const cards = placed()
  if (cards.length === 0) return null
  const left = Math.min(...cards.map((card) => card.left))
  const right = Math.max(...cards.map((card) => card.left))
  const span = (scale: number) => {
    const at = placed()
    const tops = at.map((card) => card.top)
    const fixed = at.map((card) => card.fixed)
    return {
      top: Math.min(...tops),
      fixed: Math.min(...fixed),
      height:
        (Math.max(...tops) - Math.min(...tops) + geometry.height + gridCardInset) * scale +
        Math.max(...fixed) -
        Math.min(...fixed),
    }
  }
  const leading = cards.some((card) => card.leading)
  const trailing = cards.some((card) => card.trailing && card.left === right)
  const fit = fitGridBounds(
    right - left + geometry.width,
    (scale) => span(scale).height,
    room,
    (scale) => groupChrome(geometry, scale, leading, trailing),
  )
  const { top, fixed } = span(fit.scale)
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
  const bounds = slideWidth > 0 ? gridElementBounds(elements, geometry.width / slideWidth) : null
  if (bounds === null) return null
  const fit = fittedGrid(bounds, room)
  const card = gridCard(geometry, index)
  if (card === null) return null
  return {
    x: fit.x - (card.left + bounds.left) * fit.scale,
    y: fit.y - (card.top + 24 + bounds.top) * fit.scale - card.fixed,
    scale: fit.scale,
  }
}

export function fittedGridGroups(geometry: GridGeometry, room: GridBounds): GridViewport {
  const { width, height } = geometry
  const lines = gridLayoutLines(geometry)
  const columns = Math.max(1, ...lines.map(gridTrackColumns))
  const handles = lines.some((line) => line.cards.length === line.end - line.start)
  const trailing = lines.some((line) => line.cards.at(-1) === line.start + columns - 1)
  return fitGridBounds(
    columns * width + (columns - 1) * gridSpacing(width, height).column,
    (scale) => gridTrackSizes(geometry, lines).reduce((total, size) => total + size.world * scale + size.fixed, 0),
    room,
    (scale) => groupChrome(geometry, scale, handles, trailing),
  )
}

export const gridGroupHandle = { offset: 32, width: 28, minimumHeight: 80 }

function groupChrome(bounds: GridGeometry, scale: number, leading: boolean, trailing: boolean) {
  const gap = gridSpacing(bounds.width, bounds.height).column * scale
  return {
    left:
      leading && bounds.groupHandles !== false && bounds.height * scale >= gridGroupHandle.minimumHeight
        ? gridGroupHandle.offset + gridGroupHandle.width / 2
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
  const card = gridCard(geometry, index)
  const chrome = groupChrome(geometry, scale, card?.leading ?? false, card?.trailing ?? false)
  return {
    left: box.left - chrome.left,
    top: box.top,
    width: box.width + chrome.left + Math.max(0, chrome.right - trailingMargin),
    height: box.height,
  }
}

function fitGridBounds(
  width: number,
  tall: (scale: number) => number,
  room: GridBounds,
  chrome: (scale: number) => { left: number; right: number },
  tallest = Number.POSITIVE_INFINITY,
): GridViewport {
  const available = room.width - 2 * fitPadding
  const widest = Math.max(1, width)
  let scale = boundedGridScale(Math.min(available / widest, tallest))
  const fits = (at: number) => {
    const { left, right } = chrome(at)
    return widest * at + left + right <= available && tall(at) <= room.height - 2 * fitPadding
  }
  if (!fits(scale)) {
    let high = scale
    scale = zoomRanges.grid.least / 100
    for (let i = 0; i < 40; i++) {
      const middle = (scale + high) / 2
      if (fits(middle)) scale = middle
      else high = middle
    }
  }
  const { left, right } = chrome(scale)
  return {
    x: (room.width - width * scale + left - right) / 2,
    y: (room.height - tall(scale)) / 2,
    scale,
  }
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

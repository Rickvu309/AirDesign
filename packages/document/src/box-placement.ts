import type { Box } from "./box.js"
import type { PixelSize } from "./media-bytes.js"

export type PlacementArea = { readonly width: number; readonly height: number }

const widthShare = 0.4
const heightShare = 0.12
const marginShare = 0.04
const stepShare = 0.03
const strokeReachShare = 0.02
const fittedShare = 0.2

function ascending(left: number, right: number): number {
  return left - right
}

function freeAreas(usable: Box, taken: readonly Box[]): readonly Box[] {
  const xs = new Set<number>([usable.x, usable.x + usable.cx])
  for (const box of taken) {
    for (const edge of [box.x, box.x + box.cx]) {
      if (edge > usable.x && edge < usable.x + usable.cx) xs.add(edge)
    }
  }
  const edges = [...xs].sort(ascending)
  const areas: Box[] = []
  for (let from = 0; from < edges.length; from += 1) {
    for (let to = from + 1; to < edges.length; to += 1) {
      const left = edges[from] ?? 0
      const right = edges[to] ?? 0
      const crossing = taken
        .filter((box) => box.x < right && left < box.x + box.cx)
        .map((box) => ({ top: Math.max(box.y, usable.y), bottom: Math.min(box.y + box.cy, usable.y + usable.cy) }))
        .filter((band) => band.bottom > band.top)
        .sort((a, b) => a.top - b.top)
      let cursor = usable.y
      for (const band of crossing) {
        if (band.top > cursor) areas.push({ x: left, y: cursor, cx: right - left, cy: band.top - cursor })
        cursor = Math.max(cursor, band.bottom)
      }
      if (usable.y + usable.cy > cursor) {
        areas.push({ x: left, y: cursor, cx: right - left, cy: usable.y + usable.cy - cursor })
      }
    }
  }
  return areas
}

function larger(left: Box, right: Box): number {
  const byArea = right.cx * right.cy - left.cx * left.cy
  if (byArea !== 0) return byArea
  return left.y - right.y || left.x - right.x
}

function centred(area: PlacementArea, size: Pick<Box, "cx" | "cy">): Box {
  return {
    x: Math.round((area.width - size.cx) / 2),
    y: Math.round((area.height - size.cy) / 2),
    cx: size.cx,
    cy: size.cy,
  }
}

function offsetFromTaken(area: PlacementArea, start: Box, taken: readonly Box[]): Box {
  const stepX = Math.round(area.width * stepShare)
  const stepY = Math.round(area.height * stepShare)
  const room = { x: area.width - start.cx, y: area.height - start.cy }
  let placed = start
  for (let count = 1; count <= 100; count += 1) {
    if (!taken.some((box) => box.x === placed.x && box.y === placed.y)) return placed
    const slot = (count % 7) - 3
    const row = Math.floor(count / 7) % 7
    placed = {
      ...start,
      x: Math.min(room.x, Math.max(0, start.x + slot * stepX)),
      y: Math.min(room.y, Math.max(0, start.y + (row - 3) * stepY + Math.max(1, Math.floor(count / 49)))),
    }
  }
  return placed
}

function reaching(box: Box, reach: number): Box {
  const cx = Math.max(box.cx, reach)
  const cy = Math.max(box.cy, reach)
  return { x: box.x - Math.round((cx - box.cx) / 2), y: box.y - Math.round((cy - box.cy) / 2), cx, cy }
}

type Size = Pick<Box, "cx" | "cy">

function present(area: PlacementArea, taken: readonly Box[]): readonly Box[] {
  const reach = Math.round(area.height * strokeReachShare)
  return taken.filter((box) => box.cx > 0 || box.cy > 0).map((box) => reaching(box, reach))
}

function clearAreas(area: PlacementArea, taken: readonly Box[]): readonly Box[] {
  const marginX = Math.round(area.width * marginShare)
  const marginY = Math.round(area.height * marginShare)
  const usable = { x: marginX, y: marginY, cx: area.width - 2 * marginX, cy: area.height - 2 * marginY }
  return [...freeAreas(usable, present(area, taken))].sort(larger)
}

export function largestFreeBox(area: PlacementArea, taken: readonly Box[]): Box | undefined {
  return clearAreas(area, taken)[0]
}

function centredIn(free: Box, size: Size): Box {
  return { x: free.x + Math.round((free.cx - size.cx) / 2), y: free.y + Math.round((free.cy - size.cy) / 2), ...size }
}

export function placeNewBox(
  area: PlacementArea,
  taken: readonly Box[],
  size: Size = { cx: Math.round(area.width * widthShare), cy: Math.round(area.height * heightShare) },
): Box {
  const best = clearAreas(area, taken).find((free) => free.cx >= size.cx && free.cy >= size.cy)
  if (best !== undefined) return centredIn(best, size)
  return offsetFromTaken(area, centred(area, size), present(area, taken))
}

function shrunk(free: Box, size: Size): Size {
  const scale = Math.min(1, free.cx / size.cx, free.cy / size.cy)
  return { cx: Math.max(1, Math.floor(size.cx * scale)), cy: Math.max(1, Math.floor(size.cy * scale)) }
}

export function fitNewBox(area: PlacementArea, taken: readonly Box[], size: Size, floor = fittedShare): Box {
  const areas = clearAreas(area, taken)
  if (areas.some((free) => free.cx >= size.cx && free.cy >= size.cy)) return placeNewBox(area, taken, size)
  const smallest = Math.round(area.height * floor)
  const gap = Math.round(area.height * strokeReachShare)
  const fits = areas
    .map((each) => ({ x: each.x + gap, y: each.y + gap, cx: each.cx - 2 * gap, cy: each.cy - 2 * gap }))
    .filter((free) => free.cx > 0 && free.cy > 0)
    .map((free) => ({ free, fitted: shrunk(free, size) }))
    .filter(({ fitted }) => Math.min(fitted.cx, fitted.cy) >= smallest)
    .sort((left, right) => right.fitted.cx * right.fitted.cy - left.fitted.cx * left.fitted.cy)[0]
  if (fits === undefined) return placeNewBox(area, taken, size)
  return centredIn(fits.free, fits.fitted)
}

const emuPerPixel = 9525
const pictureShare = 0.9

export function pictureSize(natural: PixelSize, area: PlacementArea): Size {
  const width = Math.max(1, natural.width) * emuPerPixel
  const height = Math.max(1, natural.height) * emuPerPixel
  const scale = Math.min(1, (area.width * pictureShare) / width, (area.height * pictureShare) / height)
  return { cx: Math.max(1, Math.round(width * scale)), cy: Math.max(1, Math.round(height * scale)) }
}

export function fittedInside(box: Box, natural: PixelSize): Box {
  const scale = Math.min(box.cx / Math.max(1, natural.width), box.cy / Math.max(1, natural.height))
  const size = {
    cx: Math.max(1, Math.round(Math.max(1, natural.width) * scale)),
    cy: Math.max(1, Math.round(Math.max(1, natural.height) * scale)),
  }
  return centredIn(box, size)
}

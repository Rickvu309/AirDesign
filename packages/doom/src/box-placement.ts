import type { PlacementRules } from "./placement-rules.js"

type Box = { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number }

export type PlacementArea = { readonly width: number; readonly height: number }
type Clearance = Pick<PlacementRules, "freeMarginShare" | "strokeReachShare">

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

function reaching(box: Box, reach: number): Box {
  const cx = Math.max(box.cx, reach)
  const cy = Math.max(box.cy, reach)
  return { x: box.x - Math.round((cx - box.cx) / 2), y: box.y - Math.round((cy - box.cy) / 2), cx, cy }
}

function present(area: PlacementArea, taken: readonly Box[], rules: Clearance): readonly Box[] {
  const reach = Math.round(area.height * rules.strokeReachShare)
  return taken.filter((box) => box.cx > 0 || box.cy > 0).map((box) => reaching(box, reach))
}

function clearAreas(area: PlacementArea, taken: readonly Box[], rules: Clearance): readonly Box[] {
  const marginX = Math.round(area.width * rules.freeMarginShare)
  const marginY = Math.round(area.height * rules.freeMarginShare)
  const usable = { x: marginX, y: marginY, cx: area.width - 2 * marginX, cy: area.height - 2 * marginY }
  return freeAreas(usable, present(area, taken, rules))
}

export function largestFreeBox(
  area: PlacementArea,
  taken: readonly Box[],
  rules: Clearance,
  score: (box: Box) => number = ({ cx, cy }) => cx * cy,
): Box | undefined {
  let best: Box | undefined
  let high = -Infinity
  for (const box of clearAreas(area, taken, rules)) {
    const next = score(box)
    if (
      next > high ||
      (next === high && best !== undefined && (box.y < best.y || (box.y === best.y && box.x < best.x)))
    ) {
      best = box
      high = next
    }
  }
  return best
}

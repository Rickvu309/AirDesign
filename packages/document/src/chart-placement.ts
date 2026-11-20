import type { Box } from "./box.js"
import { fitNewBox, type PlacementArea } from "./box-placement.js"
import type { ElementId } from "./element-id.js"

export type PlacedChart = { readonly node: ElementId; readonly box: Box }
export type ChartPlacement = { readonly box: Box; readonly moved: PlacedChart | null }

type Size = Pick<Box, "cx" | "cy">

const marginShare = 0.04
const gapShare = 0.03
const readableShare = 0.75
const smallShare = 0.1

function overlap(left: Box, right: Box): number {
  const width = Math.min(left.x + left.cx, right.x + right.cx) - Math.max(left.x, right.x)
  const height = Math.min(left.y + left.cy, right.y + right.cy) - Math.max(left.y, right.y)
  return width > 0 && height > 0 ? width * height : 0
}

function centred(area: PlacementArea, size: Size): Box {
  return { x: Math.round((area.width - size.cx) / 2), y: Math.round((area.height - size.cy) / 2), ...size }
}

function scaledTo(box: Size, width: number): Size {
  return box.cx <= width ? box : { cx: width, cy: Math.round((box.cy * width) / box.cx) }
}

function split(area: PlacementArea, taken: readonly Box[], partner: PlacedChart, size: Size): ChartPlacement | null {
  const margin = { x: Math.round(area.width * marginShare), y: Math.round(area.height * marginShare) }
  const gap = Math.round(area.width * gapShare)
  const column = Math.floor((area.width - 2 * margin.x - gap) / 2)
  const columns = [margin.x, margin.x + column + gap]
  const leftSide = partner.box.x + partner.box.cx / 2 <= area.width / 2
  const [own, other] = leftSide ? columns : [...columns].reverse()
  const kept = scaledTo(partner.box, column)
  const added = { cx: column, cy: Math.round((size.cy * column) / size.cx) }
  const top = Math.min(Math.max(partner.box.y, margin.y), area.height - margin.y - Math.max(kept.cy, added.cy))
  const moved = { x: (own ?? 0) + Math.round((column - kept.cx) / 2), y: Math.round(top), ...kept }
  const box = { x: other ?? 0, y: Math.round(top), ...added }
  const same = (each: Box) =>
    each.x === partner.box.x && each.y === partner.box.y && each.cx === partner.box.cx && each.cy === partner.box.cy
  const others = taken.filter((each) => !same(each))
  if (others.some((each) => overlap(each, moved) > 0 || overlap(each, box) > 0)) return null
  return { box, moved: { node: partner.node, box: moved } }
}

function besideEachOther(left: Box, right: Box): boolean {
  const apart = left.x + left.cx <= right.x || right.x + right.cx <= left.x
  return apart && left.y < right.y + right.cy && right.y < left.y + left.cy
}

function distance(left: Box, right: Box): number {
  return Math.abs(left.x + left.cx / 2 - (right.x + right.cx / 2))
}

function topAligned(area: PlacementArea, taken: readonly Box[], charts: readonly PlacedChart[], box: Box): Box {
  const neighbour = charts
    .map((chart) => chart.box)
    .filter((each) => besideEachOther(each, box))
    .sort((left, right) => distance(left, box) - distance(right, box))[0]
  if (neighbour === undefined) return box
  const lined = { ...box, y: neighbour.y }
  const onSlide = lined.y >= 0 && lined.y + lined.cy <= area.height
  return onSlide && !taken.some((each) => overlap(each, lined) > 0) ? lined : box
}

export function placeChart(
  area: PlacementArea,
  taken: readonly Box[],
  charts: readonly PlacedChart[],
  size: Size,
  splits = true,
): ChartPlacement {
  const fitted = fitNewBox(area, taken, size)
  const clear = !taken.some((box) => overlap(box, fitted) > 0)
  if (clear && fitted.cx >= size.cx * readableShare)
    return { box: topAligned(area, taken, charts, fitted), moved: null }
  const wanted = centred(area, size)
  const partner = [...charts]
    .filter((chart) => overlap(chart.box, wanted) > 0)
    .sort((left, right) => overlap(right.box, wanted) - overlap(left.box, wanted))[0]
  const shared = partner === undefined || !splits ? null : split(area, taken, partner, size)
  if (shared !== null) return shared
  const small = clear ? fitted : fitNewBox(area, taken, size, smallShare)
  const free = !taken.some((box) => overlap(box, small) > 0)
  return { box: free ? topAligned(area, taken, charts, small) : fitted, moved: null }
}

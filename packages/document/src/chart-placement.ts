import type { Box } from "./box.js"
import { fitNewBox, type PlacementArea } from "./box-placement.js"
import type { ElementId } from "./element-id.js"

export type PlacedChart = { readonly node: ElementId; readonly box: Box }
export type ChartPlacement = { readonly box: Box; readonly moved: PlacedChart | null }

type Size = Pick<Box, "cx" | "cy">

const marginShare = 0.04
const gapShare = 0.03
const readableShare = 0.75

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
  const middle = Math.min(
    Math.max(partner.box.y + partner.box.cy / 2, margin.y + Math.max(kept.cy, added.cy) / 2),
    area.height - margin.y - Math.max(kept.cy, added.cy) / 2,
  )
  const moved = { x: (own ?? 0) + Math.round((column - kept.cx) / 2), y: Math.round(middle - kept.cy / 2), ...kept }
  const box = { x: other ?? 0, y: Math.round(middle - added.cy / 2), ...added }
  const same = (each: Box) =>
    each.x === partner.box.x && each.y === partner.box.y && each.cx === partner.box.cx && each.cy === partner.box.cy
  const others = taken.filter((each) => !same(each))
  if (others.some((each) => overlap(each, moved) > 0 || overlap(each, box) > 0)) return null
  return { box, moved: { node: partner.node, box: moved } }
}

export function placeChart(
  area: PlacementArea,
  taken: readonly Box[],
  charts: readonly PlacedChart[],
  size: Size,
): ChartPlacement {
  const fitted = fitNewBox(area, taken, size)
  const clear = !taken.some((box) => overlap(box, fitted) > 0)
  if (clear && fitted.cx >= size.cx * readableShare) return { box: fitted, moved: null }
  const wanted = centred(area, size)
  const partner = [...charts]
    .filter((chart) => overlap(chart.box, wanted) > 0)
    .sort((left, right) => overlap(right.box, wanted) - overlap(left.box, wanted))[0]
  const shared = partner === undefined ? null : split(area, taken, partner, size)
  return shared ?? { box: fitted, moved: null }
}

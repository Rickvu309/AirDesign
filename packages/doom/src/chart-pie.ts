import { axisUnit, formatValue, seriesPrecision } from "./chart-axis.js"
import { type Context, type Entry, markColor, markId, strong, valueId } from "./chart-context.js"
import { chartLayout } from "./chart-layout.js"
import { slice, spot, whole, words, wordsWidth } from "./chart-parts.js"
import { sliceLabelSpot } from "./chart-slice-label.js"
import type { Box, Resolved } from "./resolved.js"

const pieShare = 0.46
const pieFloorShare = 0.4

export function pieChart(context: Context): Resolved[] {
  const { chart, theme, board, bounds, lineH } = context
  const series = chart.series[0]
  if (series === undefined) return []
  const digits = seriesPrecision(chart.series)
  const shares = chart.categories.map((category, at) => ({ category, at, value: Math.max(0, series.values[at] ?? 0) }))
  const total = shares.reduce((sum, share) => sum + share.value, 0)
  const percent = (value: number) => (total === 0 ? "0%" : `${String(Math.round((value / total) * 100))}%`)
  const entries: Entry[] = shares.map((share) => ({
    name: share.category,
    color: markColor(context, 0, share.at),
    note: percent(share.value),
  }))
  const floor = Math.min(context.w, context.h) * pieFloorShare
  const sizeIn = (region: Box) => Math.max(0, Math.min(region.w, region.h, context.w * pieShare))
  const { legend: legendParts, region } = chartLayout(context, {
    entries,
    header: axisUnit(chart.unit),
    sides: ["right", "below"],
    used: sizeIn,
    plot: (region) => ({ fits: sizeIn(region) >= floor, score: sizeIn(region) }),
  })
  const diameter = sizeIn(region)
  const beside = region.w < context.w
  const area: Box = spot(
    beside ? 0 : (region.w - diameter) / 2,
    region.y + (region.h - diameter) / 2,
    diameter,
    diameter,
  )
  const radius = diameter / 2
  const parts: Resolved[] = []
  const live = shares.filter((share) => share.value > 0)
  let angle = -Math.PI / 2
  for (const share of live) {
    const id = markId(context, 0, share.at)
    const color = entries[share.at]!.color
    if (live.length === 1) {
      parts.push(whole(id, area, color))
      continue
    }
    const sweep = (share.value / total) * Math.PI * 2
    const next = angle + sweep
    const point = (turn: number) =>
      `${(radius + radius * Math.cos(turn)).toFixed(2)} ${(radius + radius * Math.sin(turn)).toFixed(2)}`
    const d = `M${String(radius)} ${String(radius)}L${point(angle)}A${String(radius)} ${String(radius)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${point(next)}Z`
    parts.push(slice(id, area, d, color, theme.colors.background))
    if (chart.labels === true) {
      const shown =
        chart.unit === undefined
          ? [percent(share.value)]
          : [formatValue(share.value, digits, chart.unit), percent(share.value)]
      const tries = shown.flatMap((text) => {
        const w = wordsWidth(context, text, strong(theme)) + 2
        const spotted = sliceLabelSpot(radius, angle, next, w, lineH)
        return spotted === null
          ? []
          : [
              words(
                valueId(context, 0, share.at),
                context,
                text,
                spot(area.x + radius + spotted.x - w / 2, area.y + radius + spotted.y - lineH / 2, w, lineH),
                { ...strong(theme), color: theme.colors.background },
              ),
            ]
      })
      const kept = board.first(tries, bounds)
      if (kept !== undefined) parts.push(kept)
    }
    angle = next
  }
  return [...parts, ...legendParts]
}

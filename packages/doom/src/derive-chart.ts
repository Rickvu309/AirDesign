import { type Axis, formatTick, formatValue, niceAxis, seriesPrecision, slug } from "./chart-axis.js"
import {
  type Kit,
  type Words,
  block,
  disc,
  rule,
  slice,
  spot,
  stroked,
  whole,
  words,
  wordsHeight,
  wordsWidth,
} from "./chart-parts.js"
import type { Chart } from "./chart.js"
import { resolveColor } from "./color.js"
import type { NodeId } from "./ids.js"
import type { Hex } from "./paint.js"
import type { Box, Resolved } from "./resolved.js"
import type { Theme } from "./theme.js"

type Context = Kit & {
  readonly frame: NodeId
  readonly chart: Chart
  readonly w: number
  readonly h: number
  readonly lineH: number
  readonly seriesColors: readonly Hex[]
}
type Entry = { readonly name: string; readonly color: Hex; readonly note?: string }

const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
const markShare = 0.5
const legendGap = 28

const dataId = (context: Context, series: string, category: string) =>
  `${context.frame}#${slug(series)}:${slug(category)}`

function axisLabels(chart: Chart): {
  readonly tick: (value: number) => string
  readonly value: (value: number) => string
} {
  const digits = seriesPrecision(chart.series)
  return {
    tick: (value) => formatTick(value, digits, chart.unit),
    value: (value) => formatValue(value, digits),
  }
}

function seriesColorsOf(chart: Chart, theme: Theme): readonly Hex[] {
  const own = chart.series.map((series) => (series.color === undefined ? undefined : resolveColor(series.color, theme)))
  const free = accents.map((name) => theme.colors[name]).filter((color) => !own.includes(color))
  const fallback = free.length === 0 ? accents.map((name) => theme.colors[name]) : free
  let next = 0
  return own.map((color) => color ?? fallback[next++ % fallback.length]!)
}

const colorAt = (context: Context, index: number, id: string): Hex => {
  const { chart, theme } = context
  const point = chart.points?.[id]
  if (point !== undefined) return resolveColor(point, theme)
  if (chart.kind !== "pie") return context.seriesColors[index] ?? theme.colors.accent1
  const own = chart.series[index]?.color
  return own === undefined ? theme.colors[accents[index % accents.length]!] : resolveColor(own, theme)
}

const muted = (theme: Theme): Words => ({ style: "caption", color: theme.colors.text2, align: "left" })
const strong = (theme: Theme): Words => ({ style: "caption", color: theme.colors.text, align: "center", bold: true })

function legendOf(context: Context, entries: readonly Entry[], x: number, y: number, vertical: boolean): Resolved[] {
  const parts: Resolved[] = []
  const look = muted(context.theme)
  const noteLook = { ...look, color: context.theme.colors.text }
  const noteGap = 24
  const swatch = Math.round(context.lineH * markShare)
  const nameRoom = Math.max(0, ...entries.map((entry) => wordsWidth(context, entry.name, look)))
  let at = vertical ? y : x
  for (const entry of entries) {
    const textW = wordsWidth(context, entry.name, look)
    const left = vertical ? x : at
    const top = vertical ? at : y
    parts.push(
      block(
        `${context.frame}#~swatch:${slug(entry.name)}`,
        spot(left, top + (context.lineH - swatch) / 2, swatch, swatch),
        entry.color,
        3,
      ),
    )
    parts.push(
      words(
        `${context.frame}#~legend:${slug(entry.name)}`,
        context,
        entry.name,
        spot(left + swatch + 10, top, textW + 2, context.lineH),
        look,
      ),
    )
    if (entry.note !== undefined) {
      const noteW = wordsWidth(context, entry.note, noteLook)
      parts.push(
        words(
          `${context.frame}#~note:${slug(entry.name)}`,
          context,
          entry.note,
          spot(left + swatch + 10 + nameRoom + noteGap, top, noteW + 2, context.lineH),
          noteLook,
        ),
      )
    }
    at += vertical ? context.lineH + 18 : swatch + 10 + textW + legendGap
  }
  return parts
}

function valueAxis(context: Context): Axis {
  const { chart } = context
  const sums = chart.categories.map((_, at) => {
    let up = 0
    let down = 0
    for (const series of chart.series) {
      const value = series.values[at] ?? 0
      if (value >= 0) up += value
      else down += value
    }
    return { up, down }
  })
  const flat = chart.series.flatMap((series) => series.values)
  const stacked = chart.kind === "stacked"
  const hi = Math.max(0, ...(stacked ? sums.map((sum) => sum.up) : flat))
  const lo = Math.min(0, ...(stacked ? sums.map((sum) => sum.down) : flat))
  return niceAxis(lo, hi)
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

function barChart(context: Context): Resolved[] {
  const { chart, theme, frame } = context
  const horizontal = chart.kind === "bar"
  const axis = valueAxis(context)
  const labels = axisLabels(chart)
  const tickWords = axis.ticks.map(labels.tick)
  const look = muted(theme)
  const legend: Entry[] =
    chart.series.length > 1
      ? chart.series.map((series, index) => ({ name: series.name, color: colorAt(context, index, "") }))
      : []
  const legendH = legend.length > 0 ? context.lineH + 22 : 0
  const labelled = chart.labels === true
  const valueRoom = Math.max(0, ...tickWords.map((text) => wordsWidth(context, text, look))) + 16
  const categoryRoom = Math.max(0, ...chart.categories.map((name) => wordsWidth(context, name, look))) + 28
  const left = horizontal ? categoryRoom : valueRoom
  const right = horizontal && labelled ? valueRoom + 4 : 2
  const bottomRoom = context.lineH + 14
  const top = legendH + (horizontal ? 6 : labelled ? context.lineH + 10 : 10)
  const bottom = context.h - bottomRoom
  const along = horizontal ? { from: left, to: context.w - right } : { from: bottom, to: top }
  const place = (value: number) => along.from + ((value - axis.lo) / (axis.hi - axis.lo)) * (along.to - along.from)
  const zero = place(0)
  const count = Math.max(1, chart.categories.length)
  const bandSize = horizontal ? (bottom - top) / count : (context.w - left - right) / count
  const parts: Resolved[] = [...legendOf(context, legend, left, 0, false)]
  const chrome: Resolved[] = []
  axis.ticks.forEach((tick, index) => {
    const at = place(tick)
    const faint = tick === 0 ? 0 : 0.28
    if (horizontal) {
      parts.push(
        rule(`${frame}#~grid:${String(index)}`, { x: at, y: top }, { x: at, y: bottom }, theme.colors.text2, 1, faint),
      )
      const w = wordsWidth(context, tickWords[index]!, look) + 8
      chrome.push(
        words(
          `${frame}#~tick:${String(index)}`,
          context,
          tickWords[index]!,
          spot(clamp(at - w / 2, 0, context.w - w), bottom + 8, w, context.lineH),
          { ...look, align: "center" },
        ),
      )
    } else {
      parts.push(
        rule(
          `${frame}#~grid:${String(index)}`,
          { x: left, y: at },
          { x: context.w - right, y: at },
          theme.colors.text2,
          1,
          faint,
        ),
      )
      chrome.push(
        words(
          `${frame}#~tick:${String(index)}`,
          context,
          tickWords[index]!,
          spot(0, at - context.lineH / 2, left - 10, context.lineH),
          { ...look, align: "right" },
        ),
      )
    }
  })
  const clusters = chart.kind !== "stacked"
  const crowd = chart.series.length
  const groupSize = bandSize * (clusters ? 0.64 : 0.52)
  const gap = clusters && crowd > 1 ? 6 : 0
  const barSize = clusters ? (groupSize - gap * (crowd - 1)) / crowd : groupSize
  const barLook = strong(theme)
  chart.categories.forEach((category, at) => {
    const band = (horizontal ? top : left) + bandSize * at
    const start = band + (bandSize - groupSize) / 2
    let up = 0
    let down = 0
    chart.series.forEach((series, index) => {
      const value = series.values[at] ?? 0
      const id = dataId(context, series.name, category)
      const color = colorAt(context, index, id)
      const reach = clusters ? 0 : value >= 0 ? up : down
      const from = place(reach)
      const to = place(reach + value)
      if (!clusters) {
        if (value >= 0) up += value
        else down += value
      }
      const offset = clusters ? (barSize + gap) * index : 0
      const lead = Math.min(from, to)
      const length = Math.abs(to - from)
      const box = horizontal ? spot(lead, start + offset, length, barSize) : spot(start + offset, lead, barSize, length)
      parts.push(block(id, box, color))
      if (!labelled) return
      const shown = labels.value(value)
      const w = wordsWidth(context, shown, barLook) + 12
      if (!clusters) {
        if (length < context.lineH + 6) return
        parts.push(
          words(
            `${frame}#~value:${slug(series.name)}:${slug(category)}`,
            context,
            shown,
            spot(box.x + (box.w - w) / 2, box.y + (box.h - context.lineH) / 2, w, context.lineH),
            { ...barLook, color: theme.colors.background },
          ),
        )
      } else if (horizontal) {
        const x = value >= 0 ? box.x + box.w + 6 : box.x - 6 - w
        parts.push(
          words(
            `${frame}#~value:${slug(series.name)}:${slug(category)}`,
            context,
            shown,
            spot(clamp(x, 0, context.w - w), box.y + (box.h - context.lineH) / 2, w, context.lineH),
            { ...barLook, align: value >= 0 ? "left" : "right" },
          ),
        )
      } else {
        const y = value >= 0 ? box.y - context.lineH - 2 : box.y + box.h + 2
        parts.push(
          words(
            `${frame}#~value:${slug(series.name)}:${slug(category)}`,
            context,
            shown,
            spot(clamp(box.x + (box.w - w) / 2, 0, context.w - w), y, w, context.lineH),
            barLook,
          ),
        )
      }
    })
    if (horizontal)
      chrome.push(
        words(`${frame}#~category:${slug(category)}`, context, category, spot(0, band, left - 20, bandSize), {
          ...look,
          align: "right",
        }),
      )
    else
      chrome.push(
        words(
          `${frame}#~category:${slug(category)}`,
          context,
          category,
          spot(band, bottom + 10, bandSize, context.lineH),
          { ...look, align: "center" },
        ),
      )
  })
  const baseline = horizontal
    ? rule(`${frame}#~baseline`, { x: zero, y: top }, { x: zero, y: bottom }, theme.colors.text, 2, 0.7)
    : rule(`${frame}#~baseline`, { x: left, y: zero }, { x: context.w - right, y: zero }, theme.colors.text, 2, 0.7)
  return [...parts, baseline, ...chrome]
}

function lineChart(context: Context): Resolved[] {
  const { chart, theme, frame } = context
  const axis = valueAxis(context)
  const labels = axisLabels(chart)
  const look = muted(theme)
  const legend: Entry[] =
    chart.series.length > 1
      ? chart.series.map((series, index) => ({ name: series.name, color: colorAt(context, index, "") }))
      : []
  const legendH = legend.length > 0 ? context.lineH + 22 : 0
  const labelled = chart.labels === true
  const left = Math.max(0, ...axis.ticks.map((tick) => wordsWidth(context, labels.tick(tick), look))) + 16
  const top = legendH + (labelled ? context.lineH + 12 : 14)
  const bottom = context.h - (context.lineH + 14)
  const place = (value: number) => bottom - ((value - axis.lo) / (axis.hi - axis.lo)) * (bottom - top)
  const band = (context.w - left) / Math.max(1, chart.categories.length)
  const parts: Resolved[] = [...legendOf(context, legend, left, 0, false)]
  axis.ticks.forEach((tick, index) => {
    const at = place(tick)
    const text = labels.tick(tick)
    parts.push(
      rule(
        `${frame}#~grid:${String(index)}`,
        { x: left, y: at },
        { x: context.w, y: at },
        tick === 0 ? theme.colors.text : theme.colors.text2,
        tick === 0 ? 2 : 1,
        tick === 0 ? 0.7 : 0.28,
      ),
    )
    parts.push(
      words(
        `${frame}#~tick:${String(index)}`,
        context,
        text,
        spot(0, at - context.lineH / 2, left - 10, context.lineH),
        { ...look, align: "right" },
      ),
    )
  })
  chart.categories.forEach((category, at) => {
    parts.push(
      words(
        `${frame}#~category:${slug(category)}`,
        context,
        category,
        spot(left + band * at, bottom + 10, band, context.lineH),
        { ...look, align: "center" },
      ),
    )
  })
  const plot = spot(left, top, context.w - left, bottom - top)
  const markerSize = Math.round(context.lineH * markShare)
  chart.series.forEach((series, index) => {
    const color = colorAt(context, index, "")
    const points = chart.categories.map((category, at) => ({
      category,
      x: left + band * (at + 0.5),
      y: place(series.values[at] ?? 0),
      value: series.values[at] ?? 0,
    }))
    const d = points
      .map((point, at) => `${at === 0 ? "M" : "L"}${(point.x - plot.x).toFixed(2)} ${(point.y - plot.y).toFixed(2)}`)
      .join("")
    if (points.length > 1) parts.push(stroked(`${frame}#${slug(series.name)}`, plot, d, color, 4))
    for (const point of points) {
      const id = dataId(context, series.name, point.category)
      parts.push(
        disc(
          id,
          spot(point.x - markerSize / 2, point.y - markerSize / 2, markerSize, markerSize),
          colorAt(context, index, id),
          theme.colors.background,
        ),
      )
      if (!labelled) continue
      const shown = labels.value(point.value)
      const w = wordsWidth(context, shown, strong(theme)) + 12
      parts.push(
        words(
          `${frame}#~value:${slug(series.name)}:${slug(point.category)}`,
          context,
          shown,
          spot(
            clamp(point.x - w / 2, 0, context.w - w),
            point.y - markerSize / 2 - context.lineH - 2,
            w,
            context.lineH,
          ),
          strong(theme),
        ),
      )
    }
  })
  return parts
}

function pieChart(context: Context): Resolved[] {
  const { chart, theme, frame } = context
  const series = chart.series[0]
  if (series === undefined) return []
  const shares = chart.categories.map((category, at) => ({ category, at, value: Math.max(0, series.values[at] ?? 0) }))
  const total = shares.reduce((sum, share) => sum + share.value, 0)
  const diameter = Math.min(context.h, context.w * 0.46)
  const area: Box = spot(0, (context.h - diameter) / 2, diameter, diameter)
  const radius = diameter / 2
  const entries: Entry[] = shares.map((share) => ({
    name: share.category,
    color: colorAt(context, share.at, dataId(context, series.name, share.category)),
    note: total === 0 ? "0%" : `${String(Math.round((share.value / total) * 100))}%`,
  }))
  const rowsH = entries.length * (context.lineH + 18) - 18
  const parts: Resolved[] = []
  const live = shares.filter((share) => share.value > 0)
  let angle = -Math.PI / 2
  for (const share of live) {
    const id = dataId(context, series.name, share.category)
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
      const middle = angle + sweep / 2
      const shown = `${String(Math.round((share.value / total) * 100))}%`
      const w = wordsWidth(context, shown, strong(theme)) + 12
      const cx = area.x + radius + radius * 0.66 * Math.cos(middle)
      const cy = area.y + radius + radius * 0.66 * Math.sin(middle)
      parts.push(
        words(
          `${frame}#~value:${slug(series.name)}:${slug(share.category)}`,
          context,
          shown,
          spot(clamp(cx - w / 2, 0, context.w - w), cy - context.lineH / 2, w, context.lineH),
          { ...strong(theme), color: theme.colors.background },
        ),
      )
    }
    angle = next
  }
  return [...parts, ...legendOf(context, entries, diameter + 64, (context.h - rowsH) / 2, true)]
}

export function deriveChart(
  frame: NodeId,
  chart: Chart,
  box: Box,
  theme: Theme,
  measure: Kit["measure"],
): readonly Resolved[] {
  const kit = { theme, measure }
  const context: Context = {
    ...kit,
    frame,
    chart,
    w: box.w,
    h: box.h,
    lineH: wordsHeight(kit, { style: "caption", color: theme.colors.text, bold: false }),
    seriesColors: seriesColorsOf(chart, theme),
  }
  if (chart.kind === "pie") return pieChart(context)
  if (chart.kind === "line") return lineChart(context)
  return barChart(context)
}

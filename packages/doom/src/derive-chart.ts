import { type Axis, axisUnit, formatCompact, formatValue, seriesPrecision } from "./chart-axis.js"
import {
  type Context,
  clamp,
  markColor,
  markId,
  seriesColor,
  valueId,
  markShare,
  muted,
  seriesColorsOf,
  smaller,
  strong,
} from "./chart-context.js"
import { inkBoard, overlaps, textBoxes } from "./chart-ink.js"
import { type Room, chartLayout } from "./chart-layout.js"
import { legendEntries } from "./chart-legend.js"
import { pieChart } from "./chart-pie.js"
import {
  type Kit,
  type Words,
  block,
  disc,
  rule,
  spot,
  stroked,
  words,
  wordsHeight,
  wordsWidth,
} from "./chart-parts.js"
import {
  gutterGuess,
  gutterCap,
  horizontalTicks,
  unitLabel,
  unitWidth,
  valueAxis,
  verticalTicks,
} from "./chart-value-axis.js"
import type { Chart } from "./chart.js"
import type { NodeId } from "./ids.js"
import type { Box, Resolved } from "./resolved.js"
import type { Theme } from "./theme.js"

const valueLabels = (chart: Chart) => {
  const digits = seriesPrecision(chart.series)
  return (value: number): readonly string[] => {
    const precise = formatValue(value, digits, chart.unit)
    const short = formatCompact(value, chart.unit)
    return short === undefined || short === precise ? [precise] : [precise, short]
  }
}

type Chrome = {
  readonly above: number
  readonly below: number
  readonly left: number
  readonly right: number
  readonly captionInGutter: boolean
}

const plotHeightShare = 0.4
const plotWidthShare = 0.35

const within = (context: Context, region: Box): Context => ({
  ...context,
  w: region.x + region.w,
  h: region.y + region.h,
  bounds: spot(0, 0, region.x + region.w, region.y + region.h),
})

function roomFor(context: Context, region: Box, chrome: Chrome): Room {
  const w = region.w - chrome.left - chrome.right
  const h = region.h - chrome.above - chrome.below
  return {
    fits: h >= Math.max(3 * context.lineH, context.h * plotHeightShare) && w >= context.w * plotWidthShare,
    score: Math.min(w / context.w, h / context.h),
  }
}

function chromeOf(context: Context, axis: Axis): Chrome {
  const { chart, lineH, theme } = context
  const unit = axisUnit(chart.unit)
  const labelled = chart.labels === true
  const row = lineH + 14
  if (chart.kind === "bar") {
    const look = strong(theme)
    const text = valueLabels(chart)
    const widest = Math.max(
      0,
      ...chart.series.flatMap((series) => series.values.map((one) => wordsWidth(context, text(one)[0]!, look))),
    )
    return {
      above: 6,
      below: row + (unit === undefined ? 0 : lineH + 2),
      left: categoryRoom(context),
      right: labelled ? Math.min(gutterCap(context) + 10, widest + 22) : 2,
      captionInGutter: false,
    }
  }
  const caption = unit === undefined ? 0 : unitWidth(context, unit)
  const captionInGutter = unit !== undefined && caption <= gutterCap(context)
  const line = chart.kind === "line"
  return {
    above: labelled ? lineH + (line ? 12 : 10) : Math.max(line ? 14 : 10, lineH / 2 + 2),
    below: unit === undefined ? row : captionInGutter ? Math.max(row, captionDrop(context) + lineH) : row + lineH + 2,
    left: gutterGuess(context, axis, captionInGutter ? caption : 0),
    right: line ? 0 : 2,
    captionInGutter,
  }
}

const captionDrop = (context: Context) => context.lineH / 2 + 2

const categoryRoom = (context: Context) =>
  Math.min(
    context.frameW * 0.4,
    Math.max(0, ...context.chart.categories.map((name) => wordsWidth(context, name, muted(context.theme)))) + 28,
  )

function axisLayout(context: Context, axis: Axis) {
  const chrome = (region: Box) => chromeOf(within(context, region), axis)
  const layout = chartLayout(context, {
    entries: legendEntries(context),
    header: undefined,
    sides: ["top", "right"],
    indent: chromeOf(context, axis).left,
    besideTop: (region) => region.y + chrome(region).above,
    plot: (region) => roomFor(context, region, chrome(region)),
  })
  return { ...layout, plot: within(context, layout.region), chrome: chrome(layout.region) }
}

type Candidate = { readonly value: number; readonly tries: readonly Resolved[]; readonly own?: Box }

function placeValues(
  context: Context,
  candidates: readonly Candidate[],
  area: Box,
  bars: readonly Box[] = [],
): Resolved[] {
  return [...candidates]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .flatMap((candidate) => {
      const clear = candidate.tries.filter((part) =>
        textBoxes(part).every((ink) => !bars.some((bar) => bar !== candidate.own && overlaps(ink, bar))),
      )
      const kept = context.board.first(clear, area)
      return kept === undefined ? [] : [kept]
    })
}

function categoryNames(context: Context, make: (look: Words) => (index: number) => Resolved): Resolved[] {
  const { chart, board, bounds, theme } = context
  const count = chart.categories.length
  const [normal, small] = [muted(theme), smaller(context, muted(theme))].map(make)
  const roomy = board.spaced(count, 0, bounds, normal!)
  const tight = roomy.length < count ? board.spaced(count, 0, bounds, small!) : []
  const kept = tight.length > roomy.length ? tight.map(small!) : roomy.map(normal!)
  board.take(kept)
  return kept
}

function bottomNames(context: Context, left: number, band: number, y: number): Resolved[] {
  const { chart, frame } = context
  return categoryNames(context, (muted) => (index) => {
    const look = { ...muted, align: "center" as const }
    const name = chart.categories[index]!
    const w = wordsWidth(context, name, look) + 2
    return words(
      `${frame}#~category:${String(index)}`,
      context,
      name,
      spot(left + band * (index + 0.5) - w / 2, y, w, wordsHeight(context, look)),
      look,
    )
  })
}

function captionParts(plot: Context, chrome: Chrome, bottom: number, tickRight: number): Resolved[] {
  const unit = axisUnit(plot.chart.unit)
  if (unit === undefined) return []
  if (plot.chart.kind === "bar")
    return [unitLabel(plot, unit, plot.w - chrome.right, bottom + 10 + plot.lineH, "right")]
  const y = chrome.captionInGutter ? bottom + captionDrop(plot) : bottom + 12 + plot.lineH
  return [unitLabel(plot, unit, tickRight, y, "right")]
}

function barChart(context: Context): Resolved[] {
  const { chart, theme, frame, board, lineH } = context
  const horizontal = chart.kind === "bar"
  const axis = valueAxis(chart)
  const { legend, region, plot, chrome } = axisLayout(context, axis)
  const valueText = valueLabels(chart)
  const barLook = strong(theme)
  const labelled = chart.labels === true
  const edge = plot.w
  const top = region.y + chrome.above
  const bottom = region.y + region.h - chrome.below
  const count = Math.max(1, chart.categories.length)
  const gutter = horizontal
    ? null
    : verticalTicks(
        plot,
        axis,
        (tick) => bottom - ((tick - axis.lo) / (axis.hi - axis.lo)) * (bottom - top),
        chrome.left - 16,
      )
  const left = horizontal ? chrome.left : gutter!.left
  const right = chrome.right
  const along = horizontal ? { from: left, to: edge - right } : { from: bottom, to: top }
  const place = (tick: number) => along.from + ((tick - axis.lo) / (axis.hi - axis.lo)) * (along.to - along.from)
  const zero = place(0)
  const bandSize = horizontal ? (bottom - top) / count : (edge - left - right) / count
  const parts: Resolved[] = [...legend]
  const chrome2: Resolved[] = []
  const tickParts = horizontal ? horizontalTicks(plot, axis, place, bottom + 8).parts : gutter!.parts
  board.take(tickParts)
  chrome2.push(...tickParts)
  for (const tick of tickParts) {
    const index = Number(tick.id.slice(tick.id.lastIndexOf(":") + 1))
    const at = place(axis.ticks[index]!)
    const faint = axis.ticks[index] === 0 ? 0 : 0.28
    parts.push(
      horizontal
        ? rule(`${frame}#~grid:${String(index)}`, { x: at, y: top }, { x: at, y: bottom }, theme.colors.text2, 1, faint)
        : rule(
            `${frame}#~grid:${String(index)}`,
            { x: left, y: at },
            { x: edge - right, y: at },
            theme.colors.text2,
            1,
            faint,
          ),
    )
  }
  chrome2.push(...captionParts(plot, chrome, bottom, left - 10))
  if (horizontal) {
    chrome2.push(
      ...categoryNames(plot, (look) => (index) => {
        const nameH = wordsHeight(context, look)
        return words(
          `${frame}#~category:${String(index)}`,
          context,
          chart.categories[index]!,
          spot(0, top + bandSize * (index + 0.5) - nameH / 2, left - 20, nameH),
          { ...look, align: "right" },
        )
      }),
    )
  } else chrome2.push(...bottomNames(plot, left, bandSize, bottom + 10))
  const clusters = chart.kind !== "stacked"
  const crowd = chart.series.length
  const groupSize = bandSize * (clusters ? 0.64 : 0.6)
  const gap = clusters && crowd > 1 ? Math.min(6, (groupSize * 0.25) / (crowd - 1)) : 0
  const barSize = clusters ? (groupSize - gap * (crowd - 1)) / crowd : groupSize
  const candidates: Candidate[] = []
  const bars: Box[] = []
  chart.categories.forEach((_, at) => {
    const band = (horizontal ? top : left) + bandSize * at
    const start = band + (bandSize - groupSize) / 2
    let up = 0
    let down = 0
    chart.series.forEach((series, index) => {
      const value = series.values[at] ?? 0
      const id = markId(context, index, at)
      const color = markColor(context, index, at)
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
      bars.push(box)
      if (!labelled) return
      const labelId = valueId(context, index, at)
      const triesFor = (text: string): readonly Resolved[] => {
        const w = wordsWidth(context, text, barLook) + 2
        const on = (x: number, y: number, look: Words) => words(labelId, context, text, spot(x, y, w, lineH), look)
        const centred = (look: Words) => on(box.x + (box.w - w) / 2, box.y + (box.h - lineH) / 2, look)
        const onBar =
          box.h >= lineH + (horizontal ? 0 : 6) && w - 2 <= box.w - 4
            ? [centred({ ...barLook, color: theme.colors.background })]
            : []
        if (!clusters) return onBar
        if (horizontal) {
          const middle = box.y + (box.h - lineH) / 2
          return value >= 0
            ? [on(box.x + box.w + 6, middle, { ...barLook, align: "left" }), ...onBar]
            : [
                on(box.x - 6 - w, middle, { ...barLook, align: "right" }),
                on(box.x + box.w + 6, middle, { ...barLook, align: "left" }),
                ...onBar,
              ]
        }
        const x = box.x + (box.w - w) / 2
        return [on(x, value >= 0 ? box.y - lineH - 2 : box.y + box.h + 2, barLook), ...onBar]
      }
      candidates.push({ value, own: box, tries: valueText(value).flatMap(triesFor) })
    })
  })
  const area = horizontal
    ? spot(left, top, edge - left, bottom - top)
    : spot(left, region.y, edge - right - left, bottom - region.y)
  parts.push(...placeValues(context, candidates, area, bars))
  const baseline = horizontal
    ? rule(`${frame}#~baseline`, { x: zero, y: top }, { x: zero, y: bottom }, theme.colors.text, 2, 0.7)
    : rule(`${frame}#~baseline`, { x: left, y: zero }, { x: edge - right, y: zero }, theme.colors.text, 2, 0.7)
  return [...parts, baseline, ...chrome2]
}

function lineChart(context: Context): Resolved[] {
  const { chart, theme, frame, board, lineH } = context
  const axis = valueAxis(chart)
  const { legend, region, plot: room, chrome } = axisLayout(context, axis)
  const valueText = valueLabels(chart)
  const labelled = chart.labels === true
  const edge = room.w
  const top = region.y + chrome.above
  const bottom = region.y + region.h - chrome.below
  const place = (value: number) => bottom - ((value - axis.lo) / (axis.hi - axis.lo)) * (bottom - top)
  const gutter = verticalTicks(room, axis, place, chrome.left - 16)
  const left = gutter.left
  const band = (edge - left) / Math.max(1, chart.categories.length)
  const parts: Resolved[] = [...legend]
  const ticks = gutter.parts
  board.take(ticks)
  for (const tick of ticks) {
    const index = Number(tick.id.slice(tick.id.lastIndexOf(":") + 1))
    const value = axis.ticks[index]!
    parts.push(
      rule(
        `${frame}#~grid:${String(index)}`,
        { x: left, y: place(value) },
        { x: edge, y: place(value) },
        value === 0 ? theme.colors.text : theme.colors.text2,
        value === 0 ? 2 : 1,
        value === 0 ? 0.7 : 0.28,
      ),
    )
  }
  parts.push(...ticks, ...captionParts(room, chrome, bottom, left - 10), ...bottomNames(room, left, band, bottom + 10))
  const plot = spot(left, top, edge - left, bottom - top)
  const markerSize = Math.round(lineH * markShare)
  const valueLook = strong(theme)
  const valueHeight = wordsHeight(context, valueLook)
  const candidates: Candidate[] = []
  chart.series.forEach((series, index) => {
    const color = seriesColor(context, index)
    const points = chart.categories.map((category, at) => ({
      category,
      x: left + band * (at + 0.5),
      y: place(series.values[at] ?? 0),
      value: series.values[at] ?? 0,
    }))
    const d = points
      .map((point, at) => `${at === 0 ? "M" : "L"}${(point.x - plot.x).toFixed(2)} ${(point.y - plot.y).toFixed(2)}`)
      .join("")
    if (points.length > 1) parts.push(stroked(`${frame}#${String(index)}`, plot, d, color, 4))
    for (const [pointAt, point] of points.entries()) {
      const id = markId(context, index, pointAt)
      parts.push(
        disc(
          id,
          spot(point.x - markerSize / 2, point.y - markerSize / 2, markerSize, markerSize),
          markColor(context, index, pointAt),
          theme.colors.background,
        ),
      )
      if (!labelled) continue
      candidates.push({
        value: point.value,
        tries: valueText(point.value).map((text) => {
          const w = wordsWidth(context, text, valueLook) + 2
          return words(
            valueId(context, index, pointAt),
            context,
            text,
            spot(clamp(point.x - w / 2, left, edge - w), point.y - markerSize / 2 - valueHeight - 2, w, valueHeight),
            valueLook,
          )
        }),
      })
    }
  })
  const area = spot(left, region.y, edge - left, bottom - region.y)
  parts.push(...placeValues(context, candidates, area))
  return parts
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
    frameW: box.w,
    lineH: wordsHeight(kit, { style: "caption", color: theme.colors.text, bold: false }),
    seriesColors: seriesColorsOf(chart, theme),
    board: inkBoard(),
    bounds: spot(0, 0, box.w, box.h),
  }
  if (chart.kind === "pie") return pieChart(context)
  if (chart.kind === "line") return lineChart(context)
  return barChart(context)
}

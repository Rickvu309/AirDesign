import { type Axis, compactFirst, formatValue, niceAxis, scaledTicks, stepPrecision } from "./chart-axis.js"
import { type Context, clamp, muted, smaller } from "./chart-context.js"
import { type Words, spot, words, wordsWidth } from "./chart-parts.js"
import type { Chart } from "./chart.js"
import type { Resolved } from "./resolved.js"

const gutterShare = 0.3

export const gutterCap = (context: Context) => context.frameW * gutterShare - 10

export function valueAxis(chart: Chart): Axis {
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

type TickLook = { readonly text: (value: number) => string; readonly look: Words }

function tickLooks(context: Context, axis: Axis): readonly TickLook[] {
  const { chart } = context
  const look = muted(context.theme)
  const exact = (value: number) => formatValue(value, stepPrecision(axis), chart.unit)
  const scaled = scaledTicks(axis, chart.unit)
  const texts = scaled === undefined ? [exact] : compactFirst(axis) ? [scaled] : [exact, scaled]
  const shortest = texts[texts.length - 1]!
  return [...texts.map((text) => ({ text, look })), { text: shortest, look: smaller(context, look) }]
}

const endsOf = (axis: Axis): readonly number[] => [0, axis.ticks.length - 1, axis.ticks.indexOf(0)]

type Layout = (index: number) => Resolved
type Try = { readonly tick: TickLook; readonly layout: (room: number) => Layout }

const roomOf = (context: Context, axis: Axis, tick: TickLook) =>
  axis.ticks.map((value) => wordsWidth(context, tick.text(value), tick.look))

function firstFitting(context: Context, axis: Axis, tries: readonly Try[], least = 0) {
  const cap = gutterCap(context)
  const zero = axis.ticks.indexOf(0)
  for (const [at, one] of tries.entries()) {
    const widths = roomOf(context, axis, one.tick)
    const room = Math.max(least, ...widths)
    const last = at === tries.length - 1
    if (Math.max(0, ...widths) > cap && !last) continue
    const part = one.layout(room)
    const kept = context.board.spaced(axis.ticks.length, zero, context.bounds, part, endsOf(axis))
    const found = kept.length > 0 || !last ? kept : context.board.spaced(axis.ticks.length, zero, context.bounds, part)
    if (found.length > 0 || last) return { kept: found, room, parts: found.map(part) }
  }
  return { kept: [], room: 0, parts: [] }
}

export function gutterGuess(context: Context, axis: Axis, least = 0): number {
  const cap = gutterCap(context)
  const rooms = tickLooks(context, axis).map((tick) => Math.max(0, ...roomOf(context, axis, tick)))
  return Math.max(least, rooms.find((room) => room <= cap) ?? rooms[rooms.length - 1]!) + 16
}

const tickId = (context: Context, index: number) => `${context.frame}#~tick:${String(index)}`

export function verticalTicks(context: Context, axis: Axis, place: (value: number) => number, least = 0) {
  const { lineH } = context
  const tries = tickLooks(context, axis).map((tick) => ({
    tick,
    layout: (room: number) => (index: number) =>
      words(
        tickId(context, index),
        context,
        tick.text(axis.ticks[index]!),
        spot(0, place(axis.ticks[index]!) - lineH / 2, room + 6, lineH),
        { ...tick.look, align: "right" as const },
      ),
  }))
  const found = firstFitting(context, axis, tries, least)
  return { kept: found.kept, left: found.kept.length === 0 ? 8 : found.room + 16, parts: found.parts }
}

export function horizontalTicks(context: Context, axis: Axis, place: (value: number) => number, y: number) {
  const { lineH } = context
  const last = axis.ticks.length - 1
  const at = (tick: TickLook, hung: boolean) => () => (index: number) => {
    const value = axis.ticks[index]!
    const text = tick.text(value)
    const w = wordsWidth(context, text, tick.look) + 2
    const shift = hung && index === 0 ? -w / 2 : hung && index === last ? w / 2 : 0
    return words(
      tickId(context, index),
      context,
      text,
      spot(clamp(place(value) - w / 2 + shift, 0, context.w - w), y, w, lineH),
      { ...tick.look, align: "center" },
    )
  }
  const looks = tickLooks(context, axis)
  const normal = looks.slice(0, -1)
  const small = looks[looks.length - 1]!
  const tries = [
    ...normal.map((tick) => ({ tick, layout: at(tick, false) })),
    ...normal.map((tick) => ({ tick, layout: at(tick, true) })),
    { tick: small, layout: at(small, false) },
    { tick: small, layout: at(small, true) },
  ]
  return firstFitting(context, axis, tries)
}

export function unitLabel(context: Context, unit: string, x: number, y: number, align: Words["align"]): Resolved {
  const look = muted(context.theme)
  const w = Math.min(context.w, wordsWidth(context, unit, look) + 2)
  const part = words(
    `${context.frame}#~unit`,
    context,
    unit,
    spot(clamp(align === "right" ? x - w : x, 0, context.w - w), y, w, context.lineH),
    { ...look, align },
  )
  context.board.take([part])
  return part
}

export const unitWidth = (context: Context, unit: string) => wordsWidth(context, unit, muted(context.theme)) + 2

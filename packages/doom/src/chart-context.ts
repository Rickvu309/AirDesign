import type { InkBoard } from "./chart-ink.js"
import { type Kit, type Words } from "./chart-parts.js"
import type { Chart } from "./chart.js"
import { resolveColor } from "./color.js"
import type { NodeId } from "./ids.js"
import type { Hex } from "./paint.js"
import type { Box } from "./resolved.js"
import type { Theme } from "./theme.js"

export type Context = Kit & {
  readonly frame: NodeId
  readonly chart: Chart
  readonly w: number
  readonly h: number
  readonly frameW: number
  readonly lineH: number
  readonly seriesColors: readonly Hex[]
  readonly board: InkBoard
  readonly bounds: Box
}
export type Entry = { readonly name: string; readonly color: Hex; readonly note?: string }

const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
export const markShare = 0.5

export const markId = (context: Context, series: number, category: number) =>
  `${context.frame}#${String(series)}:${String(category)}`

export const valueId = (context: Context, series: number, category: number) =>
  `${context.frame}#~value:${String(series)}:${String(category)}`

export function seriesColorsOf(chart: Chart, theme: Theme): readonly Hex[] {
  const own = chart.series.map((series) => (series.color === undefined ? undefined : resolveColor(series.color, theme)))
  const free = accents.map((name) => theme.colors[name]).filter((color) => !own.includes(color))
  const fallback = free.length === 0 ? accents.map((name) => theme.colors[name]) : free
  let next = 0
  return own.map((color) => color ?? fallback[next++ % fallback.length]!)
}

export function markColor(context: Context, series: number, category: number): Hex {
  const { chart, theme } = context
  const own = chart.series[series]?.points?.find((point) => point.at === category)
  if (own !== undefined) return resolveColor(own.color, theme)
  if (chart.kind === "pie") return theme.colors[accents[category % accents.length]!]
  return seriesColor(context, series)
}

export const seriesColor = (context: Context, series: number): Hex =>
  context.seriesColors[series] ?? context.theme.colors.accent1

export const muted = (theme: Theme): Words => ({ style: "caption", color: theme.colors.text2, align: "left" })
export const strong = (theme: Theme): Words => ({
  style: "caption",
  color: theme.colors.text,
  align: "center",
  bold: true,
})

const smallerShare = 5 / 6

export const smaller = (kit: Kit, look: Words): Words => ({
  ...look,
  size: Math.round(kit.theme.textStyles[look.style].size * smallerShare),
})

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}

import {
  chartLimits,
  sameColor,
  waterfallBars,
  waterfallColor,
  type ChartFormat,
  type ChartKind,
  type ChartLegend,
  type ChartValue,
  type Color,
  type WaterfallRole,
} from "@airdesign/document"

const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
const labelsFormat: ChartFormat = "General"

export function seriesColor(chart: ChartValue, at: number): Color {
  return chart.series[at]?.color ?? { scheme: accents[at % accents.length] ?? "accent1" }
}

export function sliceColor(chart: ChartValue, at: number): Color {
  return chart.series[0]?.colors?.[at] ?? { scheme: accents[at % accents.length] ?? "accent1" }
}

export function titled(chart: ChartValue, key: "title" | "valueTitle" | "categoryTitle", text: string): ChartValue {
  const { [key]: _, ...rest } = chart
  const title = text.trim().slice(0, chartLimits.title)
  return title === "" ? rest : { ...rest, [key]: title }
}

export function chartKindEdited(chart: ChartValue, kind: ChartKind): ChartValue {
  const { totals: _, ...rest } = chart
  return kind === "waterfall" ? { ...chart, kind } : { ...rest, kind }
}

export function totalToggled(chart: ChartValue, row: number): ChartValue {
  const totals = chart.totals ?? []
  const next = totals.includes(row) ? totals.filter((at) => at !== row) : [...totals, row]
  return { ...chart, totals: [...next].sort((left, right) => left - right) }
}

export function totalsWithoutRow(totals: readonly number[], row: number): readonly number[] {
  return totals.flatMap((at) => (at === row ? [] : [at > row ? at - 1 : at]))
}

function barColors(chart: ChartValue): readonly Color[] {
  return waterfallBars(chart).map((bar, at) => chart.series[0]?.colors?.[at] ?? waterfallColor(bar.role))
}

export function roleColor(chart: ChartValue, role: WaterfallRole): Color {
  const colors = barColors(chart)
  const at = waterfallBars(chart).findIndex((bar) => bar.role === role)
  return colors[at] ?? waterfallColor(role)
}

function roleColored(chart: ChartValue, role: WaterfallRole, chosen: Color): ChartValue {
  const bars = waterfallBars(chart)
  const colors = barColors(chart).map((color, at) => (bars[at]?.role === role ? chosen : color))
  const automatic = colors.every((color, at) => sameColor(color, waterfallColor(bars[at]?.role ?? "total")))
  return {
    ...chart,
    series: chart.series.map((series, index) => {
      if (index > 0) return series
      const { colors: _, ...rest } = series
      return automatic ? rest : { ...rest, colors }
    }),
  }
}

export function chartSettingEdited(chart: ChartValue, field: string, chosen: unknown): ChartValue {
  if (field.startsWith("role."))
    return roleColored(chart, field.slice("role.".length) as WaterfallRole, chosen as Color)
  if (field === "legend") return { ...chart, legend: chosen as ChartLegend }
  if (field === "labels") {
    const { labels: _, ...rest } = chart
    return chosen === true ? { ...rest, labels: labelsFormat } : rest
  }
  if (field === "format") return { ...chart, labels: chosen as ChartFormat }
  if (field === "axis" || field === "gridlines") {
    const { [field]: _, ...rest } = chart
    return chosen === true ? rest : { ...rest, [field]: false }
  }
  if (field === "gap" && typeof chosen === "number")
    return { ...chart, gap: Math.round(Math.min(chartLimits.gap, Math.max(0, chosen))) }
  if (field.startsWith("slice.")) {
    const at = Number(field.slice("slice.".length))
    const colors = chart.categories.map((_, index) => (index === at ? (chosen as Color) : sliceColor(chart, index)))
    return { ...chart, series: chart.series.map((series, index) => (index === 0 ? { ...series, colors } : series)) }
  }
  if (!field.startsWith("color.")) return chart
  const at = Number(field.slice("color.".length))
  return {
    ...chart,
    series: chart.series.map((series, index) => (index === at ? { ...series, color: chosen as Color } : series)),
  }
}

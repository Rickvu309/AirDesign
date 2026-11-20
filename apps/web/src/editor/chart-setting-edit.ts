import { chartLimits, type ChartFormat, type ChartLegend, type ChartValue, type Color } from "@airdesign/document"

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

export function chartSettingEdited(chart: ChartValue, field: string, chosen: unknown): ChartValue {
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

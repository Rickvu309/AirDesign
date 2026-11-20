import { onlyKeys, record } from "./plain-object.js"

export const chartKinds = ["bar", "line", "pie"] as const
export const chartLimits = { categories: 24, series: 8, label: 80 } as const

export type ChartKind = (typeof chartKinds)[number]
export type ChartSeries = { readonly name: string; readonly values: readonly number[] }
export type ChartValue = {
  readonly kind: ChartKind
  readonly categories: readonly string[]
  readonly series: readonly ChartSeries[]
}

function label(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length <= chartLimits.label
}

function readSeries(raw: unknown, count: number): ChartSeries | null {
  const series = record(raw)
  if (series === null || !onlyKeys(series, ["name", "values"]) || !label(series.name)) return null
  const { values } = series
  if (!Array.isArray(values) || values.length !== count) return null
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return null
  return { name: series.name, values }
}

export function readChartValue(value: string): ChartValue | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  const chart = record(parsed)
  if (chart === null || !onlyKeys(chart, ["kind", "categories", "series"])) return null
  const kind = chartKinds.find((each) => each === chart.kind)
  const { categories } = chart
  if (kind === undefined || !Array.isArray(categories) || !categories.every(label)) return null
  if (categories.length < 1 || categories.length > chartLimits.categories) return null
  if (!Array.isArray(chart.series) || chart.series.length < 1 || chart.series.length > chartLimits.series) return null
  const series: ChartSeries[] = []
  for (const raw of chart.series) {
    const read = readSeries(raw, categories.length)
    if (read === null) return null
    series.push(read)
  }
  return { kind, categories, series }
}

export function writeChartValue(value: ChartValue): string {
  return JSON.stringify({ kind: value.kind, categories: value.categories, series: value.series })
}

const sampleCategories = ["Q1", "Q2", "Q3", "Q4"]

export function openingChart(kind: ChartKind): ChartValue {
  const first = { name: "Series 1", values: [4.1, 4.6, 5, 5.4] }
  const second = { name: "Series 2", values: [3.2, 3.5, 4.4, 4.9] }
  return { kind, categories: sampleCategories, series: kind === "pie" ? [first] : [first, second] }
}

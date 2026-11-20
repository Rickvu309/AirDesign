import { readColor, writtenColor, type Color } from "./color.js"
import { record } from "./plain-object.js"

export const chartKinds = ["bar", "line", "pie"] as const
export const chartLegends = ["bottom", "top", "right", "left", "none"] as const
export const chartFormats = ["General", "#,##0", "#,##0.0", "#,##0.00", "0%", "0.0%", "$#,##0", "$#,##0.0"] as const
export const chartLimits = { categories: 24, series: 8, label: 80, title: 120, gap: 500 } as const
export const chartGap = 80

export type ChartKind = (typeof chartKinds)[number]
export type ChartLegend = (typeof chartLegends)[number]
export type ChartFormat = (typeof chartFormats)[number]
export type ChartSeries = { readonly name: string; readonly values: readonly number[]; readonly color?: Color }
export type ChartValue = {
  readonly kind: ChartKind
  readonly categories: readonly string[]
  readonly series: readonly ChartSeries[]
  readonly title?: string
  readonly labels?: ChartFormat
  readonly axis?: boolean
  readonly gridlines?: boolean
  readonly gap?: number
  readonly legend?: ChartLegend
}

const settingKeys = ["title", "labels", "axis", "gridlines", "gap", "legend"] as const
const chartKeys = ["kind", "categories", "series", ...settingKeys]

function knownKeys(value: Readonly<Record<string, unknown>>, required: readonly string[], known: readonly string[]) {
  const own = Object.keys(value)
  return required.every((key) => own.includes(key)) && own.every((key) => known.includes(key))
}

function label(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length <= chartLimits.label
}

function readSeries(raw: unknown, count: number): ChartSeries | null {
  const series = record(raw)
  if (series === null || !knownKeys(series, ["name", "values"], ["name", "values", "color"]) || !label(series.name))
    return null
  const { values } = series
  if (!Array.isArray(values) || values.length !== count) return null
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return null
  const color = readColor(series.color)
  if (color === null) return null
  return color === undefined ? { name: series.name, values } : { name: series.name, values, color }
}

function optional<T>(raw: unknown, valid: (value: unknown) => value is T): T | undefined | null {
  if (raw === undefined) return undefined
  return valid(raw) ? raw : null
}

const isTitle = (value: unknown): value is string => typeof value === "string" && value.length <= chartLimits.title
const isFormat = (value: unknown): value is ChartFormat => chartFormats.some((each) => each === value)
const isFlag = (value: unknown): value is boolean => typeof value === "boolean"
const isGap = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= chartLimits.gap
const isLegend = (value: unknown): value is ChartLegend => chartLegends.some((each) => each === value)

type Settings = Omit<ChartValue, "kind" | "categories" | "series">

function readSettings(chart: Readonly<Record<string, unknown>>): Settings | null {
  const read = {
    title: optional(chart.title, isTitle),
    labels: optional(chart.labels, isFormat),
    axis: optional(chart.axis, isFlag),
    gridlines: optional(chart.gridlines, isFlag),
    gap: optional(chart.gap, isGap),
    legend: optional(chart.legend, isLegend),
  }
  if (Object.values(read).includes(null)) return null
  return Object.fromEntries(Object.entries(read).filter(([, value]) => value !== undefined)) as Settings
}

export function readChartValue(value: string): ChartValue | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  const chart = record(parsed)
  if (chart === null || !knownKeys(chart, ["kind", "categories", "series"], chartKeys)) return null
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
  const settings = readSettings(chart)
  return settings === null ? null : { kind, categories, series, ...settings }
}

export function writeChartValue(value: ChartValue): string {
  const settings = Object.fromEntries(
    settingKeys.flatMap((key) => (value[key] === undefined ? [] : [[key, value[key]]])),
  )
  return JSON.stringify({
    kind: value.kind,
    categories: value.categories,
    series: value.series.map((each) =>
      each.color === undefined
        ? { name: each.name, values: each.values }
        : { name: each.name, values: each.values, color: writtenColor(each.color) },
    ),
    ...settings,
  })
}

export function chartLegend(chart: ChartValue): Exclude<ChartLegend, "none"> | null {
  if (chart.legend === "none") return null
  if (chart.legend !== undefined) return chart.legend
  return chart.series.length > 1 || chart.kind === "pie" ? "bottom" : null
}

const sampleCategories = ["Q1", "Q2", "Q3", "Q4"]

export function openingChart(kind: ChartKind): ChartValue {
  const first = { name: "Series 1", values: [4.1, 4.6, 5, 5.4] }
  const second = { name: "Series 2", values: [3.2, 3.5, 4.4, 4.9] }
  return { kind, categories: sampleCategories, series: kind === "pie" ? [first] : [first, second] }
}

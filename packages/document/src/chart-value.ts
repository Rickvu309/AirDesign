import { readColor, writtenColor, type Color } from "./color.js"
import { record } from "./plain-object.js"

export const chartKinds = ["bar", "stacked", "stacked100", "horizontal", "waterfall", "line", "pie"] as const
export const chartBarKinds = ["bar", "stacked", "stacked100", "horizontal", "waterfall"] as const
export const chartLegends = ["bottom", "top", "right", "left", "none"] as const
export const chartFormats = ["General", "#,##0", "#,##0.0", "#,##0.00", "0%", "0.0%", "$#,##0", "$#,##0.0"] as const
export const chartLimits = { categories: 24, series: 8, label: 80, title: 120, gap: 500 } as const
export const chartGap = 80

export type ChartKind = (typeof chartKinds)[number]
export type ChartBarKind = (typeof chartBarKinds)[number]
export type ChartLegend = (typeof chartLegends)[number]
export type ChartFormat = (typeof chartFormats)[number]
export type ChartSeries = {
  readonly name: string
  readonly values: readonly number[]
  readonly color?: Color
  readonly colors?: readonly Color[]
}
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
  readonly valueTitle?: string
  readonly categoryTitle?: string
  readonly totals?: readonly number[]
}

const settingKeys = ["title", "labels", "axis", "gridlines", "gap", "legend", "valueTitle", "categoryTitle"] as const
const chartKeys = ["kind", "categories", "series", "totals", ...settingKeys]

function knownKeys(value: Readonly<Record<string, unknown>>, required: readonly string[], known: readonly string[]) {
  const own = Object.keys(value)
  return required.every((key) => own.includes(key)) && own.every((key) => known.includes(key))
}

function label(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length <= chartLimits.label
}

function readColors(raw: unknown, count: number): readonly Color[] | undefined | null {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw) || raw.length !== count) return null
  const colors = raw.map((each: unknown) => readColor(each))
  return colors.every((color): color is Color => color !== null && color !== undefined) ? colors : null
}

function readSeries(raw: unknown, count: number): ChartSeries | null {
  const series = record(raw)
  const known = ["name", "values", "color", "colors"]
  if (series === null || !knownKeys(series, ["name", "values"], known) || !label(series.name)) return null
  const { values } = series
  if (!Array.isArray(values) || values.length !== count) return null
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) return null
  const color = readColor(series.color)
  const colors = readColors(series.colors, count)
  if (color === null || colors === null) return null
  return {
    name: series.name,
    values,
    ...(color === undefined ? {} : { color }),
    ...(colors === undefined ? {} : { colors }),
  }
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

type Settings = Omit<ChartValue, "kind" | "categories" | "series" | "totals">

function readSettings(chart: Readonly<Record<string, unknown>>): Settings | null {
  const read = {
    title: optional(chart.title, isTitle),
    labels: optional(chart.labels, isFormat),
    axis: optional(chart.axis, isFlag),
    gridlines: optional(chart.gridlines, isFlag),
    gap: optional(chart.gap, isGap),
    legend: optional(chart.legend, isLegend),
    valueTitle: optional(chart.valueTitle, isTitle),
    categoryTitle: optional(chart.categoryTitle, isTitle),
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
  const totals = readTotals(chart.totals, kind, categories.length)
  if (settings === null || totals === null) return null
  return { kind, categories, series, ...settings, ...(totals === undefined ? {} : { totals }) }
}

function readTotals(raw: unknown, kind: ChartKind, count: number): readonly number[] | undefined | null {
  if (raw === undefined) return undefined
  if (kind !== "waterfall" || !Array.isArray(raw)) return null
  const places = raw.filter((at): at is number => Number.isInteger(at) && at >= 0 && at < count)
  if (places.length !== raw.length || new Set(places).size !== places.length) return null
  return [...places].sort((left, right) => left - right)
}

export function writeChartValue(value: ChartValue): string {
  const settings = Object.fromEntries(
    settingKeys.flatMap((key) => (value[key] === undefined ? [] : [[key, value[key]]])),
  )
  return JSON.stringify({
    kind: value.kind,
    categories: value.categories,
    series: value.series.map((each) => ({
      name: each.name,
      values: each.values,
      ...(each.color === undefined ? {} : { color: writtenColor(each.color) }),
      ...(each.colors === undefined ? {} : { colors: each.colors.map(writtenColor) }),
    })),
    ...(value.totals === undefined ? {} : { totals: [...value.totals].sort((left, right) => left - right) }),
    ...settings,
  })
}

const chartAccents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const

export function chartAccent(at: number): Color {
  return { scheme: chartAccents[at % chartAccents.length] ?? "accent1" }
}

export function chartBars(kind: ChartKind): kind is ChartBarKind {
  return chartBarKinds.some((each) => each === kind)
}

export function chartLegend(chart: ChartValue): Exclude<ChartLegend, "none"> | null {
  if (chart.legend === "none") return null
  if (chart.legend !== undefined) return chart.legend
  if (chart.kind === "waterfall") return null
  return chart.series.length > 1 || chart.kind === "pie" ? "bottom" : null
}

export type WaterfallRole = "increase" | "decrease" | "total"
export type WaterfallBar = { readonly start: number; readonly end: number; readonly role: WaterfallRole }

export function waterfallBars(chart: ChartValue): readonly WaterfallBar[] {
  const totals = new Set(chart.totals ?? [])
  let level = 0
  return (chart.series[0]?.values ?? []).map((value, at): WaterfallBar => {
    if (totals.has(at)) {
      level = value
      return { start: 0, end: value, role: "total" }
    }
    const start = level
    level = start + value
    return { start, end: level, role: value < 0 ? "decrease" : "increase" }
  })
}

const waterfallColors: Readonly<Record<WaterfallRole, Color>> = {
  increase: {
    scheme: "accent1",
    transforms: [
      { op: "lumMod", val: 60000 },
      { op: "lumOff", val: 40000 },
    ],
  },
  decrease: { scheme: "bg1", transforms: [{ op: "lumMod", val: 75000 }] },
  total: { scheme: "tx2" },
}

export function waterfallColor(role: WaterfallRole): Color {
  return waterfallColors[role]
}

const sampleCategories = ["Q1", "Q2", "Q3", "Q4"]

const sampleBridge: ChartValue = {
  kind: "waterfall",
  categories: ["FY24", "Price", "Volume", "New markets", "Churn", "FY25"],
  series: [{ name: "Revenue ($M)", values: [100, 12, 18, 9, -14, 125] }],
  totals: [0, 5],
  labels: "General",
  axis: false,
  gridlines: false,
}

export function openingChart(kind: ChartKind): ChartValue {
  if (kind === "waterfall") return sampleBridge
  const first = { name: "Series 1", values: [4.1, 4.6, 5, 5.4] }
  const second = { name: "Series 2", values: [3.2, 3.5, 4.4, 4.9] }
  return { kind, categories: sampleCategories, series: kind === "pie" ? [first] : [first, second] }
}

import { sameColor } from "./color.js"
import { type Color, readColor } from "./paint.js"
import { bytesOf } from "./limits.js"
import { type Reader, boolean, finite, integer, list, literal, object, reject, unsafe, words } from "./read-kit.js"

export type ChartPoint = { readonly at: number; readonly color: Color }

export type ChartSeries = {
  readonly name: string
  readonly values: readonly number[]
  readonly color?: Color
  readonly points?: readonly ChartPoint[]
}

export type Chart = {
  readonly kind: "bar" | "column" | "line" | "pie" | "stacked"
  readonly categories: readonly string[]
  readonly series: readonly ChartSeries[]
  readonly labels?: boolean
  readonly unit?: string
}

export const chartLimits = { categories: 200, series: 20 } as const

export const axisUnitBytes = 24

const graphemes = new Intl.Segmenter()

const printable = (typed: string): readonly string[] =>
  [...graphemes.segment(typed.replace(/[\t\n\r\u2028\u2029]+/g, " ").trim())]
    .map(({ segment }) => segment)
    .filter((segment) => !unsafe.test(segment))

export const unitHasPrintable = (typed: string): boolean => printable(typed).join("").trim() !== ""

export function fitAxisUnit(typed: string): string {
  let unit = ""
  for (const segment of printable(typed)) {
    if (bytesOf(unit + segment) > axisUnitBytes) break
    unit += segment
  }
  return unit.trim()
}

export const readAxisUnit: Reader<string> = (raw) => {
  const name = words(axisUnitBytes, 1)(raw)
  const trimmed = name.trim()
  return trimmed === "" ? reject() : trimmed
}

const readChartPoints: Reader<readonly ChartPoint[]> = list(
  object({ at: integer(0, chartLimits.categories - 1), color: readColor }),
  chartLimits.categories,
)

const readFrame = object(
  {
    kind: literal(["bar", "column", "line", "pie", "stacked"]),
    categories: list(words(200), chartLimits.categories),
    series: list(
      object(
        { name: words(200), values: list(finite(-1e12, 1e12), chartLimits.categories) },
        { color: readColor, points: readChartPoints },
      ),
      chartLimits.series,
    ),
  },
  { labels: boolean, unit: readAxisUnit },
)

function withoutSeriesColors(chart: Chart): Chart {
  return {
    ...chart,
    series: chart.series.map((series) => {
      const { color: _color, ...rest } = series
      return rest
    }),
  }
}

export function chartWithKind(chart: Chart, kind: Chart["kind"]): Chart {
  const next = { ...chart, kind }
  return kind === "pie" ? withoutSeriesColors(next) : next
}

const sortedPoints = (points: readonly ChartPoint[]): readonly ChartPoint[] =>
  [...points].sort((left, right) => left.at - right.at)

export const readChart: Reader<Chart> = (raw) => {
  const chart = readFrame(raw)
  const fits = chart.series.every(
    (series) =>
      series.values.length === chart.categories.length &&
      (series.points ?? []).every((point) => point.at < chart.categories.length) &&
      new Set((series.points ?? []).map((point) => point.at)).size === (series.points ?? []).length,
  )
  if (!fits) return reject()
  return chart.kind === "pie" ? withoutSeriesColors(chart) : chart
}

export function chartWithPointColor(chart: Chart, series: number, at: number, color: Color | null): Chart {
  const held = chart.series[series]
  if (held === undefined || at < 0 || at >= chart.categories.length) return chart
  const was = held.points?.find((point) => point.at === at)
  if (color === null ? was === undefined : was !== undefined && sameColor(was.color, color)) return chart
  const others = (held.points ?? []).filter((point) => point.at !== at)
  const points = color === null ? others : sortedPoints([...others, { at, color }])
  return { ...chart, series: chart.series.map((each, index) => (index === series ? { ...each, points } : each)) }
}

export function chartWithoutCategory(chart: Chart, at: number): Chart {
  return {
    ...chart,
    categories: chart.categories.filter((_, index) => index !== at),
    series: chart.series.map((series) => ({
      ...series,
      values: series.values.filter((_, index) => index !== at),
      ...(series.points === undefined
        ? {}
        : {
            points: series.points.flatMap((point) =>
              point.at === at ? [] : [point.at > at ? { ...point, at: point.at - 1 } : point],
            ),
          }),
    })),
  }
}

export function chartKeepingPoints(held: Chart | undefined, next: Chart): Chart {
  if (held === undefined) return next
  return {
    ...next,
    series: next.series.map((series, index) => {
      if (series.points !== undefined) return series
      const kept = (held.series[index]?.points ?? []).filter((point) => point.at < next.categories.length)
      return kept.length === 0 ? series : { ...series, points: kept }
    }),
  }
}

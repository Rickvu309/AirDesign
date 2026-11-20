import {
  chartAccent,
  chartLimits,
  sameColor,
  waterfallColor,
  type CellTexts,
  type ChartSeries,
  type ChartValue,
  type Color,
} from "@airdesign/document"
import { chartCopy } from "@/copy/chart-copy"

export type GridSpot = { readonly row: number; readonly column: number }

export function withColors(series: ChartSeries, colors: readonly Color[] | undefined, pie: boolean): ChartSeries {
  const { colors: _, ...rest } = series
  const automatic = pie && colors?.every((color, point) => sameColor(color, chartAccent(point))) === true
  return colors === undefined || automatic ? rest : { ...rest, colors }
}

export function withRow(chart: ChartValue): ChartValue {
  const count = chart.categories.length
  const added = (series: ChartSeries, at: number) =>
    chart.kind === "pie"
      ? chartAccent(count)
      : chart.kind === "waterfall"
        ? waterfallColor("increase")
        : (series.color ?? chartAccent(at))
  return {
    ...chart,
    categories: [...chart.categories, chartCopy.category(count + 1)],
    series: chart.series.map((series, at) => {
      const colors = series.colors === undefined ? undefined : [...series.colors, added(series, at)]
      return withColors({ ...series, values: [...series.values, 0] }, colors, chart.kind === "pie")
    }),
  }
}

export function withSeries(chart: ChartValue): ChartValue {
  return {
    ...chart,
    series: [
      ...chart.series,
      { name: chartCopy.seriesName(chart.series.length + 1), values: chart.categories.map(() => 0) },
    ],
  }
}

const clipped = (text: string) => text.slice(0, chartLimits.label)

export function pastedChart(
  chart: ChartValue,
  at: GridSpot,
  cells: CellTexts,
  parse: (text: string, series: number) => number | null,
): ChartValue {
  const across = Math.max(0, ...cells.map((row) => row.length))
  const rows = Math.min(at.row + cells.length, chartLimits.categories)
  const most = chart.kind === "pie" || chart.kind === "waterfall" ? 1 : chartLimits.series
  const series = Math.min(at.column - 1 + across, most)
  let next = chart
  while (next.categories.length < rows) next = withRow(next)
  while (next.series.length < series) next = withSeries(next)
  cells.forEach((texts, down) =>
    texts.forEach((text, right) => {
      const row = at.row + down
      const column = at.column + right
      if (row >= next.categories.length || column - 1 >= next.series.length) return
      if (row < 0 && column > 0)
        next = {
          ...next,
          series: next.series.map((each, index) => (index === column - 1 ? { ...each, name: clipped(text) } : each)),
        }
      else if (row >= 0 && column === 0)
        next = { ...next, categories: next.categories.map((each, index) => (index === row ? clipped(text) : each)) }
      else if (row >= 0) {
        const value = parse(text, column - 1)
        if (value === null) return
        next = {
          ...next,
          series: next.series.map((each, index) =>
            index === column - 1
              ? { ...each, values: each.values.map((old, point) => (point === row ? value : old)) }
              : each,
          ),
        }
      }
    }),
  )
  return next
}

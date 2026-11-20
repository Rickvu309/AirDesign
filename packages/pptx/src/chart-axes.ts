import type { MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import type { ChartMarkup, PaintChartLine, PaintChartLook, PaintChartTitle } from "./chart-markup.js"
import { chartLook } from "./chart-labels.js"
import { chartNumber } from "./chart-number.js"
import { chartScale, chartSteps } from "./chart-scale.js"

type AxisFrame = {
  readonly look: PaintChartLook
  readonly title: PaintChartTitle | null
  readonly line: PaintChartLine | null
  readonly gridlines: PaintChartLine | null
  readonly labels: boolean
  readonly shown: boolean
}

export type PaintChartCategoryAxis = AxisFrame & { readonly reversed: boolean }

export type PaintChartAxis = AxisFrame & {
  readonly min: number
  readonly max: number
  readonly ticks: readonly { readonly value: number; readonly text: string }[]
}

export type PaintChartAxes = {
  readonly valueAxis: PaintChartAxis | null
  readonly categoryAxis: PaintChartCategoryAxis | null
}

export type ChartAxisSource = {
  readonly plot: MarkupElement | undefined
  readonly group: MarkupElement
  readonly series: readonly { readonly values: readonly (number | null)[] }[]
  readonly grouping: "clustered" | "stacked" | "percentStacked"
  readonly base: PaintChartLook
  readonly format: string
}

const gray = { hex: "D9D9D9", alpha: 1 }
const hairline = 0.75
const percentCode = "0%"

function range(source: ChartAxisSource): readonly [number, number] {
  const { grouping, series } = source
  const count = Math.max(0, ...series.map((item) => item.values.length))
  if (grouping === "clustered") {
    const all = series.flatMap((item) => item.values.filter((value): value is number => value !== null))
    return all.length === 0 ? [0, 0] : [Math.min(...all), Math.max(...all)]
  }
  const sums = Array.from({ length: count }, (_, at) =>
    series.reduce<readonly [number, number]>(
      ([low, high], item) => {
        const value = item.values[at] ?? 0
        return value < 0 ? [low + value, high] : [low, high + value]
      },
      [0, 0],
    ),
  )
  const low = Math.min(0, ...sums.map(([below]) => below))
  const high = Math.max(0, ...sums.map(([, above]) => above))
  return grouping === "percentStacked" ? [low < 0 ? -1 : 0, high > 0 ? 1 : 0] : [low, high]
}

function frameOf(
  markup: ChartMarkup,
  axis: MarkupElement,
  base: PaintChartLook,
  title: (holder: MarkupElement | undefined) => PaintChartTitle | null,
): AxisFrame {
  const grid = markup.child(axis, "c:majorGridlines")
  const line = markup.line(markup.child(axis, "c:spPr"), hairline)
  return {
    look: chartLook(markup, markup.child(axis, "c:txPr"), base),
    title: title(markup.child(axis, "c:title")),
    line: line === undefined ? { color: gray, width: hairline } : line,
    gridlines:
      grid === undefined
        ? null
        : (markup.line(markup.child(grid, "c:spPr"), hairline) ?? { color: gray, width: hairline }),
    labels: markup.value(axis, "c:tickLblPos") !== "none",
    shown: markup.flag(axis, "c:delete") !== true,
  }
}

function plainScale(markup: ChartMarkup, axis: MarkupElement): boolean {
  const scaling = markup.child(axis, "c:scaling")
  return markup.value(scaling, "c:orientation") !== "maxMin" && markup.child(scaling, "c:logBase") === undefined
}

function reversedOrder(markup: ChartMarkup, categoryAxis: MarkupElement, valueAxis: MarkupElement): boolean | null {
  const scaling = markup.child(categoryAxis, "c:scaling")
  if (markup.child(scaling, "c:logBase") !== undefined) return null
  if (markup.value(scaling, "c:orientation") !== "maxMin") return false
  return markup.value(valueAxis, "c:crosses") === "max" ? true : null
}

export function chartAxes(
  markup: ChartMarkup,
  source: ChartAxisSource,
  title: (holder: MarkupElement | undefined) => PaintChartTitle | null,
): PaintChartAxes | null {
  const ids = new Set(markup.all(source.group, "c:axId").map((item) => paintAttribute(item, "val")))
  const owned = (kind: string) => markup.all(source.plot, kind).filter((axis) => ids.has(markup.value(axis, "c:axId")))
  const [categoryAxis, ...moreCategories] = owned("c:catAx")
  const [valueAxis, ...moreValues] = owned("c:valAx")
  const other = owned("c:dateAx").length + owned("c:serAx").length
  if (categoryAxis === undefined || valueAxis === undefined || moreCategories.length + moreValues.length + other > 0) {
    return null
  }
  const reversed = reversedOrder(markup, categoryAxis, valueAxis)
  if (reversed === null || !plainScale(markup, valueAxis)) return null
  const scaling = markup.child(valueAxis, "c:scaling")
  const [low, high] = range(source)
  const scale = chartScale(low, high, {
    min: markup.number(scaling, "c:min"),
    max: markup.number(scaling, "c:max"),
    unit: markup.number(valueAxis, "c:majorUnit"),
  })
  const format = markup.child(valueAxis, "c:numFmt")
  const linked = format === undefined || ["1", "true"].includes(paintAttribute(format, "sourceLinked") ?? "")
  const code = linked
    ? source.grouping === "percentStacked"
      ? percentCode
      : source.format
    : (paintAttribute(format, "formatCode") ?? "General")
  const ticks = chartSteps(scale).map((value) => ({ value, text: chartNumber(value, code) }))
  if (ticks.some((tick) => tick.text === null)) return null
  return {
    valueAxis: {
      ...frameOf(markup, valueAxis, source.base, title),
      min: scale.min,
      max: scale.max,
      ticks: ticks.map((tick) => ({ value: tick.value, text: tick.text ?? "" })),
    },
    categoryAxis: { ...frameOf(markup, categoryAxis, source.base, title), reversed },
  }
}

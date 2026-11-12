import type { MarkupElement } from "./element-span.js"
import { paintChild } from "./paint-fill.js"
import type { MarkupChildren } from "./text-value-route.js"
import { paintAttribute, type PaintColor, type PaintPalette } from "./paint-color.js"
import {
  chartCycle,
  chartMarkup,
  type ChartMarkup,
  type PaintChartLine,
  type PaintChartLook,
  type PaintChartTitle,
} from "./chart-markup.js"
import { chartLabels, chartLook, type PaintChartLabel } from "./chart-labels.js"
import { chartAxes, type PaintChartAxes } from "./chart-axes.js"
import { chartNumber } from "./chart-number.js"

export type { PaintChartLine, PaintChartLook, PaintChartTitle } from "./chart-markup.js"
export type { PaintChartLabel, PaintChartPosition } from "./chart-labels.js"
export type { PaintChartAxis, PaintChartCategoryAxis } from "./chart-axes.js"

export type PaintChartKind = "pie" | "doughnut" | "bar" | "column" | "line"
export type PaintChartGrouping = "clustered" | "stacked" | "percentStacked"
export type PaintChartPoint = { readonly fill: PaintColor | null; readonly line: PaintChartLine | null }

export type PaintChartSeries = {
  readonly name: string
  readonly values: readonly (number | null)[]
  readonly texts: readonly string[]
  readonly points: readonly PaintChartPoint[]
  readonly stroke: PaintChartLine | null
  readonly marker: boolean
  readonly labels: readonly (PaintChartLabel | null)[]
}

export type PaintChartLegend = {
  readonly position: "right" | "left" | "top" | "bottom"
  readonly look: PaintChartLook
  readonly entries: readonly { readonly text: string; readonly mark: PaintChartPoint }[]
}

export type PaintChart = {
  readonly kind: PaintChartKind
  readonly grouping: PaintChartGrouping
  readonly hole: number
  readonly firstAngle: number
  readonly gap: number
  readonly overlap: number
  readonly categories: readonly string[]
  readonly series: readonly PaintChartSeries[]
  readonly title: PaintChartTitle | null
  readonly legend: PaintChartLegend | null
  readonly fill: PaintColor | null
  readonly line: PaintChartLine | null
  readonly plot: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null
} & PaintChartAxes

export type ChartSource = {
  readonly parts: ReadonlyMap<string, Uint8Array>
  readonly target: (part: string, id: string) => string | undefined
  readonly colors: (part: string) => string | undefined
  readonly palette: PaintPalette
  readonly fonts: () => ReadonlyMap<string, string>
}

type Read = {
  readonly markup: ChartMarkup
  readonly cycle: (index: number) => PaintColor | null
  readonly base: PaintChartLook
}

const kinds = new Map<string, PaintChartKind>([
  ["c:pieChart", "pie"],
  ["c:doughnutChart", "doughnut"],
  ["c:barChart", "bar"],
  ["c:lineChart", "line"],
])
const groupings = new Map<string, PaintChartGrouping>([
  ["stacked", "stacked"],
  ["percentStacked", "percentStacked"],
])
const legendPlaces = new Map<string, PaintChartLegend["position"]>([
  ["r", "right"],
  ["tr", "right"],
  ["l", "left"],
  ["t", "top"],
  ["b", "bottom"],
])
const unsupportedSeriesParts = ["c:trendline", "c:errBars"]
const defaultStyle = 2
const newStyleOffset = 100
const baseSize = 10
const titleSize = 14
const lineWidth = 2.25
const hairline = 0.75
const defaultGap = 150
const defaultHole = 10
const share = 100

function cachedTexts(read: Read, holder: MarkupElement | undefined): readonly string[] | null {
  const { markup } = read
  const cache =
    markup.child(markup.child(holder, "c:strRef"), "c:strCache") ??
    markup.child(markup.child(holder, "c:numRef"), "c:numCache") ??
    markup.child(holder, "c:strLit") ??
    markup.child(holder, "c:numLit")
  if (cache === undefined) return null
  const count = markup.number(cache, "c:ptCount") ?? 0
  const format = markup.text(markup.child(cache, "c:formatCode"))
  const texts = Array.from({ length: count }, () => "")
  for (const point of markup.all(cache, "c:pt")) {
    const at = Number(paintAttribute(point, "idx"))
    const text = markup.text(markup.child(point, "c:v"))
    if (Number.isInteger(at) && at >= 0 && at < count) texts[at] = text
  }
  if (cache.kind === "c:numCache" || cache.kind === "c:numLit") {
    const written = texts.map((text) => (text === "" ? "" : chartNumber(Number(text), format || "General")))
    return written.some((text) => text === null) ? null : (written as string[])
  }
  return texts
}

function cachedValues(read: Read, holder: MarkupElement | undefined) {
  const { markup } = read
  const cache = markup.child(markup.child(holder, "c:numRef"), "c:numCache") ?? markup.child(holder, "c:numLit")
  if (cache === undefined) return null
  const count = markup.number(cache, "c:ptCount") ?? 0
  const values: (number | null)[] = Array.from({ length: count }, () => null)
  for (const point of markup.all(cache, "c:pt")) {
    const at = Number(paintAttribute(point, "idx"))
    const value = Number(markup.text(markup.child(point, "c:v")))
    if (Number.isInteger(at) && at >= 0 && at < count && Number.isFinite(value)) values[at] = value
  }
  return { values, format: markup.text(markup.child(cache, "c:formatCode")) || "General" }
}

function seriesName(read: Read, series: MarkupElement, index: number): string {
  const holder = read.markup.child(series, "c:tx")
  const direct = read.markup.child(holder, "c:v")
  if (direct !== undefined) return read.markup.text(direct)
  return cachedTexts(read, holder)?.[0] ?? `Series ${index + 1}`
}

function styleNumber(markup: ChartMarkup): number {
  const root = markup.root
  const own = markup.number(root, "c:style")
  if (own !== null) return own
  const choice = markup.child(markup.child(root, "mc:AlternateContent"), "mc:Choice")
  const fresh = markup.number(choice, "c14:style")
  return fresh === null ? defaultStyle : fresh - newStyleOffset
}

function titleOf(read: Read, holder: MarkupElement | undefined, fallback: string): PaintChartTitle | null {
  const { markup } = read
  if (holder === undefined) return null
  const base = { ...read.base, size: titleSize, bold: false }
  const rich = markup.child(markup.child(holder, "c:tx"), "c:rich")
  const look = chartLook(markup, rich ?? markup.child(holder, "c:txPr"), base)
  if (rich === undefined) {
    const cached = cachedTexts(read, markup.child(holder, "c:tx"))?.[0]
    return { text: cached ?? fallback, look }
  }
  const paragraphs = markup.all(rich, "a:p")
  const text = paragraphs
    .map((paragraph) =>
      markup
        .all(paragraph, "a:r")
        .map((run) => markup.text(markup.child(run, "a:t")))
        .join(""),
    )
    .join("\n")
  const first = markup.child(markup.child(paragraphs[0], "a:r"), "a:rPr")
  return { text, look: markup.look(first, look) }
}

type Points = { readonly points: readonly PaintChartPoint[]; readonly stroke: PaintChartLine | null } | null

function pointsOf(read: Read, series: MarkupElement, count: number, vary: boolean, kind: PaintChartKind): Points {
  const { markup, cycle } = read
  const index = markup.number(series, "c:idx") ?? 0
  const properties = markup.child(series, "c:spPr")
  const own = markup.fill(properties)
  const ownLine = markup.line(properties, kind === "line" ? lineWidth : hairline)
  if (own === "picture") return null
  const stroke = kind === "line" ? (ownLine === undefined ? lineOf(cycle(index)) : ownLine) : null
  if (kind === "line" && stroke === undefined) return null
  const points: PaintChartPoint[] = []
  for (let at = 0; at < count; at += 1) {
    const single = markup.all(series, "c:dPt").find((point) => markup.number(point, "c:idx") === at)
    const pointProperties = markup.child(single, "c:spPr")
    const fill = markup.fill(pointProperties)
    if (fill === "picture") return null
    const automatic = kind === "line" ? (stroke?.color ?? null) : cycle(vary ? at : index)
    const chosen = fill !== undefined ? fill : own !== undefined ? own : automatic
    if (fill === undefined && own === undefined && automatic === null) return null
    const line = markup.line(pointProperties, hairline)
    points.push({ fill: chosen, line: (line === undefined ? ownLine : line) ?? null })
  }
  return { points, stroke: stroke ?? null }
}

function lineOf(color: PaintColor | null): PaintChartLine | undefined {
  return color === null ? undefined : { color, width: lineWidth }
}

function markerShown(markup: ChartMarkup, group: MarkupElement, series: MarkupElement): boolean {
  const symbol = markup.value(markup.child(series, "c:marker"), "c:symbol")
  if (symbol !== null) return symbol !== "none"
  return markup.flag(group, "c:marker") === true
}

export function frameChart(
  frame: MarkupElement,
  children: MarkupChildren,
  sheet: string,
  source: ChartSource,
): { readonly chart?: PaintChart } {
  if (frame.kind !== "p:graphicFrame") return {}
  const data = paintChild(children, paintChild(children, frame, "a:graphic"), "a:graphicData")
  const pointer = paintChild(children, data, "c:chart")
  const id = pointer === undefined ? null : paintAttribute(pointer, "r:id")
  const part = id === null ? undefined : source.target(sheet, id)
  const chart = part === undefined ? null : paintChart(part, source)
  return chart === null ? {} : { chart }
}

function paintChart(part: string, source: ChartSource): PaintChart | null {
  const bytes = source.parts.get(part)
  const fonts = source.fonts()
  const markup = bytes === undefined ? null : chartMarkup(bytes, source.palette, fonts)
  if (markup === null || markup.root?.kind !== "c:chartSpace") return null
  const colorsPart = source.colors(part)
  const colors = colorsPart === undefined ? undefined : source.parts.get(colorsPart)
  if (colors === undefined && styleNumber(markup) !== defaultStyle) return null
  const cycle = chartCycle(colors ?? null, source.palette)
  const root = markup.root
  const space = markup.child(markup.child(root, "c:txPr"), "a:p")
  const base = markup.look(markup.child(markup.child(space, "a:pPr"), "a:defRPr"), {
    size: baseSize,
    bold: false,
    color: null,
    font: fonts.get("+mn-lt") ?? null,
  })
  const read: Read = { markup, cycle, base }
  const chart = markup.child(root, "c:chart")
  const plot = markup.child(chart, "c:plotArea")
  const found = childrenKinds(markup, plot)
  const group = found[0]
  if (found.length !== 1 || group === undefined) return null
  const family = kinds.get(group.kind)
  if (family === undefined) return null
  const kind: PaintChartKind = family === "bar" && markup.value(group, "c:barDir") !== "bar" ? "column" : family
  const round = kind === "pie" || kind === "doughnut"
  const grouping = groupings.get(markup.value(group, "c:grouping") ?? "") ?? "clustered"
  const listed = markup.all(group, "c:ser")
  if (listed.length === 0 || listed.some((item) => unsupportedSeriesParts.some((part) => markup.child(item, part)))) {
    return null
  }
  const ordered = [...listed].sort(
    (left, right) => (markup.number(left, "c:order") ?? 0) - (markup.number(right, "c:order") ?? 0),
  )
  const vary = markup.flag(group, "c:varyColors") ?? round
  const categories =
    markup.child(ordered[0], "c:cat") === undefined ? null : cachedTexts(read, markup.child(ordered[0], "c:cat"))
  if (categories === null && markup.child(ordered[0], "c:cat") !== undefined) return null
  const firstValues = cachedValues(read, markup.child(ordered[0], "c:val"))
  const count = Math.max(categories?.length ?? 0, firstValues?.values.length ?? 0)
  const names = categories ?? Array.from({ length: count }, (_, at) => String(at + 1))
  const series: PaintChartSeries[] = []
  for (const [at, item] of (round ? ordered.slice(0, 1) : ordered).entries()) {
    const cached = cachedValues(read, markup.child(item, "c:val"))
    if (cached === null) return null
    const values = names.map((_, point) => cached.values[point] ?? null)
    const name = seriesName(read, item, markup.number(item, "c:idx") ?? at)
    const painted = pointsOf(read, item, names.length, vary && (round || ordered.length === 1), kind)
    if (painted === null) return null
    const total = values.reduce<number>((sum, value) => sum + Math.max(value ?? 0, 0), 0)
    const labels = chartLabels(
      markup,
      markup.child(item, "c:dLbls") ?? markup.child(group, "c:dLbls"),
      values.map((value, point) => ({
        series: name,
        category: names[point] ?? "",
        value,
        share: value === null || total === 0 ? null : value / total,
        format: cached.format,
      })),
      {
        pie: round,
        position: round
          ? "outsideEnd"
          : grouping === "clustered"
            ? kind === "line"
              ? "right"
              : "outsideEnd"
            : "center",
        look: base,
      },
    )
    if (labels === null) return null
    const texts = values.map((value) =>
      value === null ? "" : (chartNumber(value, cached.format) ?? chartNumber(value, "General") ?? ""),
    )
    series.push({
      name,
      values,
      texts,
      ...painted,
      marker: kind === "line" && markerShown(markup, group, item),
      labels,
    })
  }
  const axes = round
    ? { valueAxis: null, categoryAxis: null }
    : chartAxes(markup, { plot, group, series, grouping, base, format: firstValues?.format ?? "General" }, (holder) =>
        titleOf(read, holder, "Axis Title"),
      )
  if (axes === null) return null
  const deleted = markup.flag(chart, "c:autoTitleDeleted") === true
  const titleHolder = markup.child(chart, "c:title")
  const fallback = series.length === 1 ? (series[0]?.name ?? "") : "Chart Title"
  const legendHolder = markup.child(chart, "c:legend")
  const spaceProperties = markup.child(root, "c:spPr")
  const area = markup.fill(spaceProperties)
  const manual = markup.child(markup.child(plot, "c:layout"), "c:manualLayout")
  return {
    kind,
    grouping,
    hole: kind === "doughnut" ? (markup.number(group, "c:holeSize") ?? defaultHole) / share : 0,
    firstAngle: markup.number(group, "c:firstSliceAng") ?? 0,
    gap: (markup.number(group, "c:gapWidth") ?? defaultGap) / share,
    overlap: (markup.number(group, "c:overlap") ?? (grouping === "clustered" ? 0 : share)) / share,
    categories: names,
    series,
    title: deleted && titleHolder === undefined ? null : titleOf(read, titleHolder, fallback),
    legend: legendOf(read, legendHolder, series, names, round || (vary && series.length === 1)),
    fill: area === "picture" || area === undefined ? null : area,
    line: markup.line(spaceProperties, hairline) ?? null,
    plot: plotOf(markup, manual),
    ...axes,
  }
}

function childrenKinds(markup: ChartMarkup, parent: MarkupElement | undefined): readonly MarkupElement[] {
  return [...kinds.keys(), ...otherKinds].flatMap((kind) => markup.all(parent, kind))
}

const otherKinds = [
  "c:pie3DChart",
  "c:bar3DChart",
  "c:line3DChart",
  "c:areaChart",
  "c:area3DChart",
  "c:scatterChart",
  "c:radarChart",
  "c:bubbleChart",
  "c:stockChart",
  "c:surfaceChart",
  "c:surface3DChart",
  "c:ofPieChart",
]

function plotOf(markup: ChartMarkup, manual: MarkupElement | undefined): PaintChart["plot"] {
  const edges = ["c:xMode", "c:yMode"].every((kind) => (markup.value(manual, kind) ?? "factor") === "edge")
  const [x, y, width, height] = ["c:x", "c:y", "c:w", "c:h"].map((kind) => markup.number(manual, kind))
  if (!edges || x == null || y == null || width == null || height == null) return null
  return { x, y, width, height }
}

function legendOf(
  read: Read,
  holder: MarkupElement | undefined,
  series: readonly PaintChartSeries[],
  categories: readonly string[],
  byPoint: boolean,
): PaintChartLegend | null {
  const { markup } = read
  if (holder === undefined) return null
  const hidden = new Set(
    markup
      .all(holder, "c:legendEntry")
      .filter((entry) => markup.flag(entry, "c:delete") === true)
      .map((entry) => markup.number(entry, "c:idx")),
  )
  const first = series[0]
  const entries = byPoint
    ? categories.map((text, at) => ({ text, mark: first?.points[at] ?? { fill: null, line: null } }))
    : series.map((item) => ({
        text: item.name,
        mark:
          item.stroke === null
            ? (item.points[0] ?? { fill: null, line: null })
            : { fill: item.stroke.color, line: null },
      }))
  return {
    position: legendPlaces.get(markup.value(holder, "c:legendPos") ?? "r") ?? "right",
    look: chartLook(markup, markup.child(holder, "c:txPr"), read.base),
    entries: entries.filter((_, at) => !hidden.has(at)),
  }
}

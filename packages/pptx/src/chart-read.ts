import {
  chartFormats,
  chartGap,
  chartLegend,
  chartLimits,
  sameColor,
  type ChartFormat,
  type ChartKind,
  type ChartLegend,
  type ChartSeries,
  type ChartValue,
} from "@airdesign/document"
import { colorIn } from "./color-read.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"

type Read = { readonly bytes: Uint8Array; readonly children: MarkupChildren }

const families = new Map<string, ChartKind>([
  ["c:barChart", "bar"],
  ["c:lineChart", "line"],
  ["c:pieChart", "pie"],
])
const otherFamilies = [
  "c:areaChart",
  "c:area3DChart",
  "c:bar3DChart",
  "c:bubbleChart",
  "c:doughnutChart",
  "c:line3DChart",
  "c:ofPieChart",
  "c:pie3DChart",
  "c:radarChart",
  "c:scatterChart",
  "c:stockChart",
  "c:surfaceChart",
  "c:surface3DChart",
]
const legendWords = new Map<string, Exclude<ChartLegend, "none">>([
  ["b", "bottom"],
  ["t", "top"],
  ["r", "right"],
  ["tr", "right"],
  ["l", "left"],
])
const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
const unsupportedSeriesParts = ["c:trendline", "c:errBars"]
const percentFormat: ChartFormat = "0%"
const pieGap = 150

function kids(read: Read, parent: MarkupElement | undefined, kind: string): readonly MarkupElement[] {
  return parent === undefined ? [] : (read.children[parent.index] ?? []).filter((item) => item.kind === kind)
}

function kid(read: Read, parent: MarkupElement | undefined, kind: string): MarkupElement | undefined {
  return kids(read, parent, kind)[0]
}

function attribute(element: MarkupElement | undefined, name: string): string | undefined {
  return element?.attributes.find((item) => item.name === name)?.value
}

function value(read: Read, parent: MarkupElement | undefined, kind: string): string | undefined {
  return attribute(kid(read, parent, kind), "val")
}

function on(read: Read, parent: MarkupElement | undefined, kind: string): boolean | undefined {
  const found = value(read, parent, kind)
  return found === undefined ? undefined : found === "1" || found === "true"
}

function cached(read: Read, holder: MarkupElement | undefined): readonly (string | undefined)[] | null {
  const reference = kid(read, holder, "c:strRef") ?? kid(read, holder, "c:numRef")
  const cache =
    kid(read, reference, "c:strCache") ??
    kid(read, reference, "c:numCache") ??
    kid(read, holder, "c:strLit") ??
    kid(read, holder, "c:numLit")
  if (cache === undefined) return null
  const length = Number(value(read, cache, "c:ptCount") ?? "0")
  if (!Number.isInteger(length) || length < 0 || length > chartLimits.categories) return null
  const texts: (string | undefined)[] = Array.from({ length }, () => undefined)
  for (const point of kids(read, cache, "c:pt")) {
    const at = Number(attribute(point, "idx"))
    if (Number.isInteger(at) && at >= 0 && at < length) texts[at] = holderText(read.bytes, kid(read, point, "c:v"))
  }
  return texts
}

function nameOf(read: Read, series: MarkupElement, at: number): string {
  const holder = kid(read, series, "c:tx")
  const direct = kid(read, holder, "c:v")
  if (direct !== undefined) return holderText(read.bytes, direct)
  return cached(read, holder)?.[0] ?? `Series ${String(at + 1)}`
}

function seriesColor(read: Read, series: MarkupElement, kind: ChartKind, at: number): Pick<ChartSeries, "color"> {
  const properties = kid(read, series, "c:spPr")
  const holder = kind === "line" ? kid(read, properties, "a:ln") : properties
  const fill = kid(read, holder, "a:solidFill")
  const color = fill === undefined ? null : colorIn({ element: fill, children: read.children }, null)
  const automatic = { scheme: accents[at % accents.length] ?? "accent1" } as const
  return color === null || sameColor(color, automatic) ? {} : { color }
}

function titleOf(read: Read, chart: MarkupElement | undefined, series: readonly ChartSeries[]): string | undefined {
  const holder = kid(read, chart, "c:title")
  if (holder === undefined) return undefined
  const rich = kid(read, kid(read, holder, "c:tx"), "c:rich")
  if (rich === undefined) {
    const own = cached(read, kid(read, holder, "c:tx"))?.[0]
    return own ?? (series.length === 1 ? series[0]?.name : "Chart Title")
  }
  return kids(read, rich, "a:p")
    .map((paragraph) =>
      kids(read, paragraph, "a:r")
        .map((run) => holderText(read.bytes, kid(read, run, "a:t")))
        .join(""),
    )
    .join(" ")
}

function labelsOf(read: Read, group: MarkupElement, first: MarkupElement, kind: ChartKind): ChartFormat | undefined {
  const holder = kid(read, first, "c:dLbls") ?? kid(read, group, "c:dLbls")
  if (holder === undefined || on(read, holder, "c:delete") === true) return undefined
  const percent = kind === "pie" && on(read, holder, "c:showPercent") === true
  if (on(read, holder, "c:showVal") !== true && !percent) return undefined
  const own = kid(read, holder, "c:numFmt")
  const linked = own === undefined || ["1", "true"].includes(attribute(own, "sourceLinked") ?? "0")
  const cache = kid(read, kid(read, kid(read, first, "c:val"), "c:numRef"), "c:numCache")
  const code = linked ? holderText(read.bytes, kid(read, cache, "c:formatCode")) : attribute(own, "formatCode")
  const known = chartFormats.find((format) => format === code)
  if (percent) return known?.includes("%") === true ? known : percentFormat
  return known ?? "General"
}

function plainGroup(read: Read, plot: MarkupElement | undefined): MarkupElement | null {
  const groups = [...families.keys(), ...otherFamilies].flatMap((kind) => kids(read, plot, kind))
  const [group] = groups
  if (groups.length !== 1 || group === undefined || !families.has(group.kind)) return null
  if (group.kind === "c:barChart") {
    const grouping = value(read, group, "c:grouping") ?? "clustered"
    if (value(read, group, "c:barDir") !== "col" || grouping !== "clustered") return null
  }
  if (group.kind === "c:lineChart" && (value(read, group, "c:grouping") ?? "standard") !== "standard") return null
  return group
}

type Settings = Omit<ChartValue, "kind" | "categories" | "series">

function settingsOf(
  read: Read,
  found: { readonly chart: MarkupElement; readonly plot: MarkupElement; readonly group: MarkupElement },
  value: Pick<ChartValue, "kind" | "series">,
  first: MarkupElement,
): Settings {
  const { chart, plot, group } = found
  const valueAxis = kid(read, plot, "c:valAx")
  const title = on(read, chart, "c:autoTitleDeleted") === true ? undefined : titleOf(read, chart, value.series)
  const labels = labelsOf(read, group, first, value.kind)
  const gap = Number(attribute(kid(read, group, "c:gapWidth"), "val") ?? String(pieGap))
  const legendHolder = kid(read, chart, "c:legend")
  const place = legendWords.get(attribute(kid(read, legendHolder, "c:legendPos"), "val") ?? "r") ?? "right"
  const legend: ChartLegend = legendHolder === undefined ? "none" : place
  const automatic = chartLegend({ ...value, categories: [] }) ?? "none"
  return {
    ...(title === undefined || title === "" ? {} : { title: title.slice(0, chartLimits.title) }),
    ...(labels === undefined ? {} : { labels }),
    ...(value.kind !== "pie" && on(read, valueAxis, "c:delete") === true ? { axis: false } : {}),
    ...(value.kind !== "pie" && kid(read, valueAxis, "c:majorGridlines") === undefined ? { gridlines: false } : {}),
    ...(value.kind === "bar" && gap !== chartGap && Number.isInteger(gap) && gap >= 0 && gap <= chartLimits.gap
      ? { gap }
      : {}),
    ...(legend === automatic ? {} : { legend }),
  }
}

export function chartValueOf(bytes: Uint8Array): ChartValue | null {
  let elements: readonly MarkupElement[]
  try {
    const document = markupDocument(bytes)
    if (!document.wellFormed) return null
    elements = document.elements
  } catch {
    return null
  }
  const read: Read = { bytes, children: markupChildren(elements) }
  const root = elements.find((element) => element.parent < 0)
  const chart = kid(read, root, "c:chart")
  const plot = kid(read, chart, "c:plotArea")
  const group = plainGroup(read, plot)
  const kind = group === null ? undefined : families.get(group.kind)
  if (chart === undefined || plot === undefined || group === null || kind === undefined) return null
  const listed = [...kids(read, group, "c:ser")].sort(
    (left, right) => Number(value(read, left, "c:order") ?? "0") - Number(value(read, right, "c:order") ?? "0"),
  )
  const [first] = listed
  if (first === undefined || listed.length > chartLimits.series) return null
  if (listed.some((item) => unsupportedSeriesParts.some((part) => kid(read, item, part) !== undefined))) return null
  const categories = cached(read, kid(read, first, "c:cat"))
  if (categories === null || categories.length === 0 || categories.some((text) => text === undefined)) return null
  const series: ChartSeries[] = []
  for (const [at, item] of (kind === "pie" ? listed.slice(0, 1) : listed).entries()) {
    const values = cached(read, kid(read, item, "c:val"))?.map((text) =>
      text === undefined || text.trim() === "" ? Number.NaN : Number(text),
    )
    if (values?.length !== categories.length || !values.every(Number.isFinite)) return null
    series.push({ name: nameOf(read, item, at), values, ...(kind === "pie" ? {} : seriesColor(read, item, kind, at)) })
  }
  const labels = categories as readonly string[]
  if ([...labels, ...series.map((each) => each.name)].some((text) => text.length > chartLimits.label)) return null
  return { kind, categories: labels, series, ...settingsOf(read, { chart, plot, group }, { kind, series }, first) }
}

export function chartFormatsOf(bytes: Uint8Array): readonly string[] | null {
  let elements: readonly MarkupElement[]
  try {
    const document = markupDocument(bytes)
    if (!document.wellFormed) return null
    elements = document.elements
  } catch {
    return null
  }
  const read: Read = { bytes, children: markupChildren(elements) }
  const root = elements.find((element) => element.parent < 0)
  const group = plainGroup(read, kid(read, kid(read, root, "c:chart"), "c:plotArea"))
  if (group === null) return null
  const listed = [...kids(read, group, "c:ser")].sort(
    (left, right) => Number(value(read, left, "c:order") ?? "0") - Number(value(read, right, "c:order") ?? "0"),
  )
  return listed.map((series) => {
    const cache = kid(read, kid(read, kid(read, series, "c:val"), "c:numRef"), "c:numCache")
    const code = holderText(read.bytes, kid(read, cache, "c:formatCode"))
    return code === "" ? "General" : code
  })
}

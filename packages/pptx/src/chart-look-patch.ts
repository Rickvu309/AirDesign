import { chartBars, chartGap, chartLegend, sameColor, type ChartValue, type Color } from "@airdesign/document"
import { solidFillXml } from "./color-xml.js"
import {
  axisTitleLook,
  axisTitleXml,
  barPointXml,
  chartGridlinesXml,
  chartLabelsXml,
  chartLabelInk,
  chartLineWidth,
  chartValueAxisUpright,
  seriesFillXml,
} from "./chart-space.js"
import {
  attributeSet,
  chartGroup,
  chartTree,
  orderedSeries,
  placedAfter,
  placedBefore,
  removed,
  replaced,
  treeEdited,
  treeKid,
  treeKids,
  treeRoot,
  treeValue,
  treeXml,
  type ChartTree,
} from "./chart-tree.js"
import type { ChartInk } from "./chart-ink.js"
import type { ByteEdit, MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { xmlAttribute, xmlText } from "./shape-write.js"

type Pass = (tree: ChartTree, before: ChartValue, after: ChartValue, ink: ChartInk) => readonly ByteEdit[] | null

const titleLook = '<a:defRPr sz="1400" b="1"/>'
const legendPlaces = { bottom: "b", top: "t", right: "r", left: "l" } as const
const beforeLegend = [
  "c:title",
  "c:autoTitleDeleted",
  "c:pivotFmts",
  "c:view3D",
  "c:floor",
  "c:sideWall",
  "c:backWall",
  "c:plotArea",
]
const beforeSeriesLabels = [
  "c:idx",
  "c:order",
  "c:tx",
  "c:spPr",
  "c:invertIfNegative",
  "c:pictureOptions",
  "c:marker",
  "c:explosion",
  "c:dPt",
]
const shownFlags = ["c:showVal", "c:showCatName", "c:showSerName", "c:showPercent"]
const fillKinds = ["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"]
const afterLineInShape = ["a:effectLst", "a:effectDag", "a:scene3d", "a:sp3d", "a:extLst"]

function chartOf(tree: ChartTree): MarkupElement | undefined {
  return treeKid(tree, treeRoot(tree), "c:chart")
}

function richTitle(text: string, look: string): string {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr>${look}</a:pPr><a:r><a:rPr lang="en-US"/><a:t>${xmlText(text)}</a:t></a:r></a:p></c:rich></c:tx>`
}

function wordsEdits(tree: ChartTree, rich: MarkupElement, text: string): readonly ByteEdit[] {
  const [first, ...others] = treeKids(tree, rich, "a:p")
  const run = '<a:r><a:rPr lang="en-US"/><a:t>' + xmlText(text) + "</a:t></a:r>"
  if (first === undefined) return [placedAfter(tree, rich, ["a:bodyPr", "a:lstStyle"], `<a:p>${run}</a:p>`)]
  const pieces = (tree.children[first.index] ?? []).filter((child) => ["a:r", "a:fld", "a:br"].includes(child.kind))
  const kept = pieces.find((piece) => piece.kind === "a:r")
  const words = treeKid(tree, kept, "a:t")
  const edits = [...others, ...pieces.filter((piece) => piece !== kept)].map(removed)
  if (kept === undefined || words === undefined) return [...edits, placedBefore(tree, first, ["a:endParaRPr"], run)]
  const written = words.selfClosing
    ? replaced(words, `<a:t>${xmlText(text)}</a:t>`)
    : { start: words.openEnd, end: words.closeStart, next: encodeUtf8(xmlText(text)) }
  return [...edits, written]
}

const titlePass: Pass = (tree, before, after) => {
  const wanted = after.title ?? ""
  if ((before.title ?? "") === wanted) return []
  const chart = chartOf(tree)
  if (chart === undefined) return null
  const title = treeKid(tree, chart, "c:title")
  const deleted = treeKid(tree, chart, "c:autoTitleDeleted")
  if (wanted === "") {
    const flag =
      deleted === undefined
        ? placedAfter(tree, chart, ["c:title"], '<c:autoTitleDeleted val="1"/>')
        : attributeSet(tree, deleted, "val", "1")
    return title === undefined ? [flag] : [removed(title), flag]
  }
  const shown = deleted === undefined || treeValue(deleted) === "0" ? [] : [attributeSet(tree, deleted, "val", "0")]
  if (title === undefined)
    return [
      ...shown,
      placedAfter(tree, chart, [], `<c:title>${richTitle(wanted, titleLook)}<c:overlay val="0"/></c:title>`),
    ]
  const placed = treeKid(tree, title, "c:layout")
  const kept = placed === undefined ? shown : [...shown, removed(placed)]
  const holder = treeKid(tree, title, "c:tx")
  const rich = treeKid(tree, holder, "c:rich")
  if (rich !== undefined) return [...kept, ...wordsEdits(tree, rich, wanted)]
  const paragraph = treeKid(tree, treeKid(tree, title, "c:txPr"), "a:p")
  const look = treeKid(tree, treeKid(tree, paragraph, "a:pPr"), "a:defRPr")
  const xml = richTitle(wanted, look === undefined ? titleLook : treeXml(tree, look))
  return [...kept, holder === undefined ? placedAfter(tree, title, [], xml) : replaced(holder, xml)]
}

function flagEdits(tree: ChartTree, holder: MarkupElement, values: ReadonlyMap<string, string>): readonly ByteEdit[] {
  const singles = treeKids(tree, holder, "c:dLbl").filter(
    (single) => treeValue(treeKid(tree, single, "c:delete")) !== "1",
  )
  return [holder, ...singles].flatMap((element) =>
    [...values].flatMap(([kind, value]) => {
      const flag = treeKid(tree, element, kind)
      return flag === undefined || treeValue(flag) === value ? [] : [attributeSet(tree, flag, "val", value)]
    }),
  )
}

function sharesOf(chart: ChartValue): boolean {
  return chart.kind === "pie" && chart.labels?.includes("%") === true
}

const labelsPass: Pass = (tree, before, after, ink) => {
  if (before.labels === after.labels) return []
  const group = chartGroup(tree)
  if (group === undefined) return null
  const series = orderedSeries(tree, group)
  const shared = treeKid(tree, group, "c:dLbls")
  const { labels } = after
  if (labels === undefined) {
    const off = new Map(shownFlags.map((kind) => [kind, "0"]))
    const holders = new Set(series.map((each) => treeKid(tree, each, "c:dLbls") ?? shared))
    return [...holders].flatMap((holder) => (holder === undefined ? [] : flagEdits(tree, holder, off)))
  }
  const share = sharesOf(after)
  const on = new Map([
    ["c:showVal", share ? "0" : "1"],
    ...(after.kind === "pie" ? [["c:showPercent", share ? "1" : "0"] as const] : []),
  ])
  const format = `<c:numFmt formatCode="${xmlAttribute(labels)}" sourceLinked="0"/>`
  return series.flatMap((each, at) => {
    const holder = treeKid(tree, each, "c:dLbls")
    const usable =
      holder !== undefined &&
      treeValue(treeKid(tree, holder, "c:delete")) !== "1" &&
      treeKid(tree, holder, "c:showVal") !== undefined
    if (!usable) {
      const xml = chartLabelsXml(after, chartLabelInk(after, at, ink))
      return [holder === undefined ? placedAfter(tree, each, beforeSeriesLabels, xml) : replaced(holder, xml)]
    }
    const own = treeKid(tree, holder, "c:numFmt")
    const formatEdit = own === undefined ? placedAfter(tree, holder, ["c:dLbl"], format) : replaced(own, format)
    const flagsChange = before.labels === undefined || sharesOf(before) !== share
    return [formatEdit, ...(flagsChange ? flagEdits(tree, holder, on) : [])]
  })
}

function valueAxisOf(tree: ChartTree): MarkupElement | undefined {
  const group = chartGroup(tree)
  const ids = new Set(treeKids(tree, group, "c:axId").map((axis) => treeValue(axis)))
  const plot = treeKid(tree, chartOf(tree), "c:plotArea")
  return treeKids(tree, plot, "c:valAx").find((axis) => ids.has(treeValue(treeKid(tree, axis, "c:axId"))))
}

const axisPass: Pass = (tree, before, after) => {
  if (after.kind === "pie" || (before.axis ?? true) === (after.axis ?? true)) return []
  const axis = valueAxisOf(tree)
  if (axis === undefined) return null
  const hidden = after.axis === false ? "1" : "0"
  const flag = treeKid(tree, axis, "c:delete")
  return [
    flag === undefined
      ? placedAfter(tree, axis, ["c:axId", "c:scaling"], `<c:delete val="${hidden}"/>`)
      : attributeSet(tree, flag, "val", hidden),
  ]
}

const gridlinesPass: Pass = (tree, before, after) => {
  if (after.kind === "pie" || (before.gridlines ?? true) === (after.gridlines ?? true)) return []
  const axis = valueAxisOf(tree)
  if (axis === undefined) return null
  const lines = treeKid(tree, axis, "c:majorGridlines")
  if (after.gridlines === false) return lines === undefined ? [] : [removed(lines)]
  if (lines !== undefined) return []
  return [placedAfter(tree, axis, ["c:axId", "c:scaling", "c:delete", "c:axPos"], chartGridlinesXml)]
}

const gapPass: Pass = (tree, before, after) => {
  const gap = after.gap ?? chartGap
  if (!chartBars(after.kind) || (before.gap ?? chartGap) === gap) return []
  const group = chartGroup(tree)
  if (group === undefined) return null
  const own = treeKid(tree, group, "c:gapWidth")
  return [
    own === undefined
      ? placedAfter(
          tree,
          group,
          ["c:barDir", "c:grouping", "c:varyColors", "c:ser", "c:dLbls"],
          `<c:gapWidth val="${String(gap)}"/>`,
        )
      : attributeSet(tree, own, "val", String(gap)),
  ]
}

const legendPass: Pass = (tree, before, after) => {
  const place = chartLegend(after)
  if (chartLegend(before) === place) return []
  const chart = chartOf(tree)
  if (chart === undefined) return null
  const legend = treeKid(tree, chart, "c:legend")
  if (place === null) return legend === undefined ? [] : [removed(legend)]
  const position = `<c:legendPos val="${legendPlaces[place]}"/>`
  if (legend === undefined)
    return [placedAfter(tree, chart, beforeLegend, `<c:legend>${position}<c:overlay val="0"/></c:legend>`)]
  const own = treeKid(tree, legend, "c:legendPos")
  const layout = treeKid(tree, legend, "c:layout")
  const moved =
    own === undefined ? placedAfter(tree, legend, [], position) : attributeSet(tree, own, "val", legendPlaces[place])
  return layout === undefined ? [moved] : [moved, removed(layout)]
}

function fillEdit(tree: ChartTree, holder: MarkupElement, fill: string, after: readonly string[]): ByteEdit {
  const own = (tree.children[holder.index] ?? []).find((child) => fillKinds.includes(child.kind))
  return own === undefined ? placedAfter(tree, holder, after, fill) : replaced(own, fill)
}

function labelInkEdits(tree: ChartTree, series: MarkupElement, slot: string): readonly ByteEdit[] {
  const paragraph = treeKid(tree, treeKid(tree, treeKid(tree, series, "c:dLbls"), "c:txPr"), "a:p")
  const look = treeKid(tree, treeKid(tree, paragraph, "a:pPr"), "a:defRPr")
  const scheme = treeKid(tree, treeKid(tree, look, "a:solidFill"), "a:schemeClr")
  const held = treeValue(scheme)
  if (scheme === undefined || held === slot || (held !== "tx1" && held !== "bg1")) return []
  return [attributeSet(tree, scheme, "val", slot)]
}

const colorsPass: Pass = (tree, before, after, ink) => {
  if (after.kind === "pie") return []
  const listed = orderedSeries(tree, chartGroup(tree))
  return after.series.flatMap((series, at) => {
    const element = listed[at]
    if (sameColor(before.series[at]?.color, series.color) || element === undefined) return []
    const fill = seriesFillXml(series, at)
    const properties = treeKid(tree, element, "c:spPr")
    if (chartBars(after.kind))
      return [
        properties === undefined
          ? placedAfter(tree, element, ["c:idx", "c:order", "c:tx"], `<c:spPr>${fill}</c:spPr>`)
          : fillEdit(tree, properties, fill, ["a:xfrm", "a:custGeom", "a:prstGeom"]),
        ...labelInkEdits(tree, element, chartLabelInk(after, at, ink)),
      ]
    const line = treeKid(tree, properties, "a:ln")
    const stroke = `<a:ln w="${String(chartLineWidth)}" cap="rnd">${fill}<a:round/></a:ln>`
    if (line !== undefined) return [fillEdit(tree, line, fill, [])]
    if (properties !== undefined) return [placedBefore(tree, properties, afterLineInShape, stroke)]
    return [placedAfter(tree, element, ["c:idx", "c:order", "c:tx"], `<c:spPr>${stroke}</c:spPr>`)]
  })
}

const accents = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"] as const
const beforeShapeInPoint = ["c:idx", "c:invertIfNegative", "c:marker", "c:bubble3D", "c:explosion"]

function pointColor(chart: ChartValue, series: number, point: number): Color {
  const own = chart.series[series]
  const accent = (at: number): Color => ({ scheme: accents[at % accents.length] ?? "accent1" })
  if (own?.colors?.[point] !== undefined) return own.colors[point]
  return chart.kind === "pie" ? accent(point) : (own?.color ?? accent(series))
}

const pointColorsPass: Pass = (tree, before, after) => {
  if (after.kind === "line") return []
  const listed = orderedSeries(tree, chartGroup(tree))
  return after.series.flatMap((series, at) => {
    const element = listed[at]
    const pointed = series.colors !== undefined || before.series[at]?.colors !== undefined
    if (element === undefined || (chartBars(after.kind) && !pointed) || (after.kind === "pie" && at > 0)) return []
    const singles = treeKids(tree, element, "c:dPt")
    const added: string[] = []
    const edits: ByteEdit[] = []
    for (const point of after.categories.keys()) {
      const color = pointColor(after, at, point)
      if (sameColor(pointColor(before, at, point), color)) continue
      const fill = solidFillXml(color)
      const single = singles.find((each) => treeValue(treeKid(tree, each, "c:idx")) === String(point))
      const properties = treeKid(tree, single, "c:spPr")
      if (single === undefined)
        added.push(
          after.kind === "pie"
            ? `<c:dPt><c:idx val="${String(point)}"/><c:bubble3D val="0"/><c:spPr>${fill}</c:spPr></c:dPt>`
            : barPointXml(point, fill),
        )
      else if (properties === undefined)
        edits.push(placedAfter(tree, single, beforeShapeInPoint, `<c:spPr>${fill}</c:spPr>`))
      else edits.push(fillEdit(tree, properties, fill, ["a:xfrm", "a:custGeom", "a:prstGeom"]))
    }
    return added.length === 0 ? edits : [...edits, placedAfter(tree, element, beforeSeriesLabels, added.join(""))]
  })
}

function axisOf(tree: ChartTree, kind: string): MarkupElement | undefined {
  const group = chartGroup(tree)
  const ids = new Set(treeKids(tree, group, "c:axId").map((axis) => treeValue(axis)))
  const plot = treeKid(tree, chartOf(tree), "c:plotArea")
  return treeKids(tree, plot, kind).find((axis) => ids.has(treeValue(treeKid(tree, axis, "c:axId"))))
}

const axisTitlesPass: Pass = (tree, before, after) => {
  if (after.kind === "pie") return []
  const upright = chartValueAxisUpright(after.kind)
  const axes = [
    ["c:valAx", before.valueTitle, after.valueTitle, upright],
    ["c:catAx", before.categoryTitle, after.categoryTitle, !upright],
  ] as const
  const edits: ByteEdit[] = []
  for (const [kind, had, wanted, upright] of axes) {
    if ((had ?? "") === (wanted ?? "")) continue
    const axis = axisOf(tree, kind)
    if (axis === undefined) return null
    const title = treeKid(tree, axis, "c:title")
    const rich = treeKid(tree, treeKid(tree, title, "c:tx"), "c:rich")
    if (wanted === undefined || wanted === "") edits.push(...(title === undefined ? [] : [removed(title)]))
    else if (rich !== undefined) edits.push(...wordsEdits(tree, rich, wanted))
    else {
      const paragraph = treeKid(tree, treeKid(tree, axis, "c:txPr"), "a:p")
      const look = treeKid(tree, treeKid(tree, paragraph, "a:pPr"), "a:defRPr")
      const xml = axisTitleXml(wanted, upright, look === undefined ? axisTitleLook : treeXml(tree, look))
      const after_ = ["c:axId", "c:scaling", "c:delete", "c:axPos", "c:majorGridlines", "c:minorGridlines"]
      edits.push(title === undefined ? placedAfter(tree, axis, after_, xml) : replaced(title, xml))
    }
  }
  return edits
}

const passes: readonly Pass[] = [
  titlePass,
  labelsPass,
  axisPass,
  gridlinesPass,
  gapPass,
  legendPass,
  colorsPass,
  pointColorsPass,
  axisTitlesPass,
]

export function lookPatched(
  bytes: Uint8Array,
  before: ChartValue,
  after: ChartValue,
  ink: ChartInk = () => "tx1",
): Uint8Array | null {
  let tree = chartTree(bytes)
  for (const pass of passes) {
    if (tree === null) return null
    const edits = pass(tree, before, after, ink)
    if (edits === null) return null
    tree = treeEdited(tree, edits)
  }
  return tree?.bytes ?? null
}

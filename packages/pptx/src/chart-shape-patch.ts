import { chartLegend, type ChartValue } from "@airdesign/document"
import { seriesFillXml } from "./chart-space.js"
import {
  attributeSet,
  chartGroup,
  chartTree,
  orderedSeries,
  placedAfter,
  removed,
  replaced,
  treeEdited,
  treeKid,
  treeKids,
  treeText,
  treeValue,
  treeXml,
  type ChartTree,
} from "./chart-tree.js"
import { columnLetters, columnNumber } from "./chart-workbook-check.js"
import type { ByteEdit, MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { xmlText } from "./shape-write.js"

export type Mapping = readonly (number | null)[]

const rangePattern = /^(.*!)\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/u
const fillKinds = ["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"]
const cacheKinds = ["c:strCache", "c:numCache"]
const pointFree = ["c:dPt", "c:extLst", "c:trendline", "c:errBars"]

function mapped(before: readonly string[], after: readonly string[]): Mapping {
  const kept = after.map((_, at) => (at < before.length ? at : null))
  if (after.length !== before.length - 1) return kept
  const removedAt = after.findIndex((name, at) => name !== before[at])
  if (removedAt < 0) return kept
  const shifted = after.slice(removedAt).every((name, at) => name === before[removedAt + at + 1])
  return shifted ? after.map((_, at) => (at < removedAt ? at : at + 1)) : kept
}

export function seriesMapping(before: ChartValue, after: ChartValue): Mapping {
  return mapped(
    before.series.map((series) => series.name),
    after.series.map((series) => series.name),
  )
}

export function rowMapping(before: ChartValue, after: ChartValue): Mapping {
  return mapped(before.categories, after.categories)
}

function identity(mapping: Mapping, length: number): boolean {
  return mapping.length === length && mapping.every((from, at) => from === at)
}

type Range = { readonly prefix: string; readonly column: number; readonly row: number; readonly down: boolean }

function rangeOf(formula: string, down: boolean): Range | null {
  const found = rangePattern.exec(formula.trim())
  if (found === null) return null
  const [, prefix = "", column = "", row = "", toColumn, toRow] = found
  const vertical = toColumn === undefined ? down : toColumn === column
  if (toColumn !== undefined && toColumn !== column && toRow !== row) return null
  return { prefix, column: columnNumber(column), row: Number(row), down: vertical }
}

function cell(column: number, row: number): string {
  return `$${columnLetters(column)}$${String(row)}`
}

function written(range: Range, count: number): string {
  const first = cell(range.column, range.row)
  if (count <= 1) return `${range.prefix}${first}`
  const last = range.down ? cell(range.column, range.row + count - 1) : cell(range.column + count - 1, range.row)
  return `${range.prefix}${first}:${last}`
}

function shifted(range: Range, by: number): Range {
  return range.down ? { ...range, column: range.column + by } : { ...range, row: range.row + by }
}

function cacheOf(tree: ChartTree, holder: MarkupElement | undefined) {
  const reference = treeKid(tree, holder, "c:strRef") ?? treeKid(tree, holder, "c:numRef")
  const cache =
    cacheKinds.map((kind) => treeKid(tree, reference, kind)).find((found) => found !== undefined) ??
    treeKid(tree, holder, "c:strLit") ??
    treeKid(tree, holder, "c:numLit")
  return { formula: treeKid(tree, reference, "c:f"), cache }
}

function pointsXml(values: readonly string[], from = 0): string {
  return values.map((value, at) => `<c:pt idx="${String(at + from)}"><c:v>${xmlText(value)}</c:v></c:pt>`).join("")
}

function rowEdits(
  tree: ChartTree,
  holder: MarkupElement | undefined,
  rows: Mapping,
  values: readonly string[],
  down: boolean,
): readonly ByteEdit[] | null {
  const { formula, cache } = cacheOf(tree, holder)
  if (cache === undefined) return null
  const edits: ByteEdit[] = []
  const points = treeKids(tree, cache, "c:pt")
  for (const point of points) {
    const at = rows.indexOf(Number(treeValue(point, "idx")))
    if (at < 0) edits.push(removed(point))
    else if (String(at) !== treeValue(point, "idx")) edits.push(attributeSet(tree, point, "idx", String(at)))
  }
  const fresh = rows.flatMap((from, at) => (from === null ? [at] : []))
  const xml = fresh.map((at) => pointsXml([values[at] ?? ""], at)).join("")
  if (xml !== "") edits.push(placedAfter(tree, cache, ["c:formatCode", "c:ptCount", "c:pt"], xml))
  const count = treeKid(tree, cache, "c:ptCount")
  if (count === undefined) return null
  edits.push(attributeSet(tree, count, "val", String(rows.length)))
  if (formula !== undefined) {
    const range = rangeOf(treeText(tree, formula), down)
    if (range === null) return null
    edits.push(replaced(formula, `<c:f>${xmlText(written(range, rows.length))}</c:f>`))
  }
  return edits
}

function downwards(tree: ChartTree, series: MarkupElement): boolean {
  const name = rangeOf(treeText(tree, cacheOf(tree, treeKid(tree, series, "c:tx")).formula), true)
  const values = rangeOf(treeText(tree, cacheOf(tree, treeKid(tree, series, "c:val")).formula), true)
  if (name === null || values === null) return true
  return name.column === values.column || name.row !== values.row
}

function pointLookEdits(tree: ChartTree, series: MarkupElement, rows: Mapping, pie: boolean): readonly ByteEdit[] {
  const singles = [...treeKids(tree, series, "c:dPt"), ...treeKids(tree, treeKid(tree, series, "c:dLbls"), "c:dLbl")]
  const edits: ByteEdit[] = []
  for (const single of singles) {
    const index = treeKid(tree, single, "c:idx")
    const at = rows.indexOf(Number(treeValue(index)))
    if (at < 0) edits.push(removed(single))
    else if (index !== undefined && String(at) !== treeValue(index))
      edits.push(attributeSet(tree, index, "val", String(at)))
  }
  const slices = treeKids(tree, series, "c:dPt")
  const last = slices.at(-1)
  if (!pie || last === undefined) return edits
  const fresh = rows.flatMap((from, at) => (from === null ? [at] : []))
  const template = sliceTemplate(tree, last)
  const xml = fresh.map((at) => template(at)).join("")
  return xml === ""
    ? edits
    : [...edits, placedAfter(tree, series, ["c:idx", "c:order", "c:tx", "c:spPr", "c:explosion", "c:dPt"], xml)]
}

function sliceTemplate(tree: ChartTree, slice: MarkupElement): (at: number) => string {
  const xml = treeXml(tree, slice)
  return (at) => {
    const fragment = chartTree(encodeUtf8(xml))
    const root = fragment?.elements[0]
    if (fragment === null || root === undefined) return ""
    const index = treeKid(fragment, root, "c:idx")
    const properties = treeKid(fragment, root, "c:spPr")
    const fill = (fragment.children[properties?.index ?? -1] ?? []).find((child) => fillKinds.includes(child.kind))
    const edits = [
      ...(index === undefined ? [] : [attributeSet(fragment, index, "val", String(at))]),
      ...(fill === undefined ? [] : [replaced(fill, seriesFillXml({ name: "", values: [] }, at))]),
      ...treeKids(fragment, root, "c:extLst").map(removed),
    ]
    return decodeUtf8(treeEdited(fragment, edits)?.bytes ?? new Uint8Array())
  }
}

function rowsPass(tree: ChartTree, before: ChartValue, after: ChartValue, rows: Mapping, seriesMap: Mapping) {
  const listed = orderedSeries(tree, chartGroup(tree)).slice(0, before.series.length)
  const edits: ByteEdit[] = []
  for (const [position, series] of listed.entries()) {
    const target = seriesMap.indexOf(position)
    const values =
      target < 0
        ? rows.map((from) => String(from === null ? 0 : (before.series[position]?.values[from] ?? 0)))
        : (after.series[target]?.values ?? []).map(String)
    const down = downwards(tree, series)
    const categories = rowEdits(tree, treeKid(tree, series, "c:cat"), rows, after.categories, down)
    const numbers = rowEdits(tree, treeKid(tree, series, "c:val"), rows, values, down)
    if (categories === null || numbers === null) return null
    edits.push(...categories, ...numbers, ...pointLookEdits(tree, series, rows, after.kind === "pie"))
  }
  return edits
}

type Clone = {
  readonly line: boolean
  readonly fill: string
  readonly name: string
  readonly values: readonly string[]
  readonly step: number
  readonly down: boolean
  readonly idx: number
  readonly order: number
}

function cloneEdits(fragment: ChartTree, root: MarkupElement, clone: Clone): readonly ByteEdit[] | null {
  const { name, values, step, down } = clone
  const edits: ByteEdit[] = []
  const index = treeKid(fragment, root, "c:idx")
  const order = treeKid(fragment, root, "c:order")
  if (index !== undefined) edits.push(attributeSet(fragment, index, "val", String(clone.idx)))
  if (order !== undefined) edits.push(attributeSet(fragment, order, "val", String(clone.order)))
  const tx = treeKid(fragment, root, "c:tx")
  const direct = treeKid(fragment, tx, "c:v")
  if (direct !== undefined) edits.push(replaced(direct, `<c:v>${xmlText(name)}</c:v>`))
  for (const [holder, texts] of [
    [direct === undefined ? tx : undefined, [name]],
    [treeKid(fragment, root, "c:val"), values],
  ] as const) {
    const { formula, cache } = cacheOf(fragment, holder)
    if (holder === undefined) continue
    if (cache === undefined) return null
    const points = treeKids(fragment, cache, "c:pt")
    for (const point of points) edits.push(removed(point))
    edits.push(placedAfter(fragment, cache, ["c:formatCode", "c:ptCount"], pointsXml(texts)))
    if (formula !== undefined) {
      const range = rangeOf(treeText(fragment, formula), down)
      if (range === null) return null
      edits.push(replaced(formula, `<c:f>${xmlText(written(shifted(range, step), texts.length))}</c:f>`))
    }
  }
  const properties = treeKid(fragment, root, "c:spPr")
  const painted = clone.line ? treeKid(fragment, properties, "a:ln") : properties
  const own = (fragment.children[painted?.index ?? -1] ?? []).find((child) => fillKinds.includes(child.kind))
  if (own !== undefined) edits.push(replaced(own, clone.fill))
  const labels = treeKid(fragment, root, "c:dLbls")
  edits.push(...pointFree.flatMap((kind) => treeKids(fragment, root, kind)).map(removed))
  edits.push(...treeKids(fragment, labels, "c:dLbl").map(removed))
  return edits
}

function seriesPass(tree: ChartTree, before: ChartValue, after: ChartValue, seriesMap: Mapping) {
  const group = chartGroup(tree)
  if (group === undefined) return null
  const listed = orderedSeries(tree, group)
  const edits: ByteEdit[] = []
  const gone = listed.filter((_, at) => at < before.series.length && !seriesMap.includes(at))
  edits.push(...gone.map(removed))
  if (gone.length > 0)
    for (const [position, from] of seriesMap.entries()) {
      const order = from === null ? undefined : treeKid(tree, listed[from], "c:order")
      if (order !== undefined && treeValue(order) !== String(position))
        edits.push(attributeSet(tree, order, "val", String(position)))
    }
  const fresh = seriesMap.flatMap((from, at) => (from === null ? [at] : []))
  if (fresh.length === 0) return edits
  const kept = listed.filter((element) => !gone.includes(element))
  const template = kept.at(-1)
  if (template === undefined) return null
  const down = downwards(tree, template)
  const indexes = treeKids(tree, group, "c:ser").map((element) =>
    Number(treeValue(treeKid(tree, element, "c:idx")) ?? "0"),
  )
  const orders = kept.map((element) => Number(treeValue(treeKid(tree, element, "c:order")) ?? "0"))
  const clones: string[] = []
  for (const [count, at] of fresh.entries()) {
    const series = after.series[at]
    const fragment = chartTree(encodeUtf8(treeXml(tree, template)))
    const root = fragment?.elements[0]
    if (series === undefined || fragment === null || root === undefined) return null
    const made = cloneEdits(fragment, root, {
      line: after.kind === "line",
      fill: seriesFillXml(series, at),
      name: series.name,
      values: series.values.map(String),
      step: count + 1,
      down,
      idx: Math.max(...indexes) + count + 1,
      order: gone.length > 0 ? at : Math.max(...orders) + count + 1,
    })
    const result = made === null ? null : treeEdited(fragment, made)
    if (result === null) return null
    clones.push(decodeUtf8(result.bytes))
  }
  edits.push(placedAfter(tree, group, ["c:barDir", "c:grouping", "c:varyColors", "c:ser"], clones.join("")))
  return edits
}

export function shapePatched(bytes: Uint8Array, before: ChartValue, after: ChartValue): Uint8Array | null {
  const seriesMap = after.kind === "pie" ? [0] : seriesMapping(before, after)
  const rows = rowMapping(before, after)
  let tree = chartTree(bytes)
  if (tree === null) return null
  if (!identity(rows, before.categories.length)) {
    const edits = rowsPass(tree, before, after, rows, seriesMap)
    tree = edits === null ? null : treeEdited(tree, edits)
  }
  if (tree === null) return null
  if (!identity(seriesMap, before.series.length)) {
    const edits = seriesPass(tree, before, after, seriesMap)
    tree = edits === null ? null : treeEdited(tree, edits)
  }
  return tree?.bytes ?? null
}

export function lookBefore(before: ChartValue, after: ChartValue): ChartValue {
  const seriesMap = after.kind === "pie" ? [0] : seriesMapping(before, after)
  return {
    ...before,
    legend: chartLegend(before) ?? "none",
    series: after.series.map((series, at) => {
      const from = seriesMap[at]
      const source = from === null || from === undefined ? undefined : before.series[from]
      if (source !== undefined) return source
      const { color: _, ...rest } = series
      return rest
    }),
  }
}

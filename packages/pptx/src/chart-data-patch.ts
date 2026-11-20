import type { ChartValue } from "@airdesign/document"
import type { ChartInk } from "./chart-ink.js"
import { lookPatched } from "./chart-look-patch.js"
import { chartValueOf } from "./chart-read.js"
import { lookBefore, shapePatched } from "./chart-shape-patch.js"
import {
  chartGroup,
  chartTree,
  orderedSeries,
  treeKid,
  treeKids,
  treeText,
  treeValue,
  type ChartTree,
} from "./chart-tree.js"
import { syncedWorkbook } from "./chart-workbook-sync.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { xmlText } from "./shape-write.js"

type Parts = ReadonlyMap<string, Uint8Array>

function cacheOf(tree: ChartTree, holder: MarkupElement | undefined): MarkupElement | undefined {
  const reference = treeKid(tree, holder, "c:strRef") ?? treeKid(tree, holder, "c:numRef")
  return (
    treeKid(tree, reference, "c:strCache") ??
    treeKid(tree, reference, "c:numCache") ??
    treeKid(tree, holder, "c:strLit") ??
    treeKid(tree, holder, "c:numLit")
  )
}

function pointEdits(
  tree: ChartTree,
  cache: MarkupElement | undefined,
  values: readonly (string | number)[],
): readonly ByteEdit[] | null {
  if (cache === undefined) return null
  const numeric = cache.kind === "c:numCache" || cache.kind === "c:numLit"
  const edits: ByteEdit[] = []
  for (const [at, value] of values.entries()) {
    const point = treeKids(tree, cache, "c:pt").find((each) => Number(treeValue(each, "idx")) === at)
    const shown = treeKid(tree, point, "c:v")
    if (shown === undefined || shown.selfClosing) return null
    if (numeric && !Number.isFinite(Number(value))) return null
    const held = treeText(tree, shown)
    const same = numeric ? held.trim() !== "" && Number(held) === Number(value) : held === String(value)
    if (!same) edits.push({ start: shown.openEnd, end: shown.closeStart, next: encodeUtf8(xmlText(String(value))) })
  }
  return edits
}

function dataEdits(tree: ChartTree, chart: ChartValue): readonly ByteEdit[] | null {
  const listed = orderedSeries(tree, chartGroup(tree))
  const edits: ByteEdit[] = []
  for (const [at, series] of chart.series.entries()) {
    const element = listed[at]
    if (element === undefined) return null
    const tx = treeKid(tree, element, "c:tx")
    const direct = treeKid(tree, tx, "c:v")
    const holders: [MarkupElement | undefined, readonly (string | number)[]][] = [
      [cacheOf(tree, treeKid(tree, element, "c:cat")), chart.categories],
      [cacheOf(tree, treeKid(tree, element, "c:val")), series.values],
    ]
    if (direct === undefined || direct.selfClosing) holders.push([cacheOf(tree, tx), [series.name]])
    else if (treeText(tree, direct) !== series.name)
      edits.push({ start: direct.openEnd, end: direct.closeStart, next: encodeUtf8(xmlText(series.name)) })
    for (const [cache, values] of holders) {
      const patched = pointEdits(tree, cache, values)
      if (patched === null) return null
      edits.push(...patched)
    }
  }
  return edits
}

function linkedWorkbook(parts: Parts, chartPart: string, tree: ChartTree): string | null {
  const external = tree.elements.find((element) => element.kind === "c:externalData")
  const id = external?.attributes.find((item) => item.name.endsWith(":id"))?.value
  const rels = chartTree(parts.get(relsOf(chartPart)))
  if (id === undefined || rels === null) return null
  const row = rels.elements.find((element) => element.kind === "Relationship" && treeValue(element, "Id") === id)
  const target = treeValue(row, "Target")
  if (target === undefined || treeValue(row, "TargetMode") === "External") return null
  return (treeValue(row, "Type") ?? "").endsWith("/package") ? partOf(chartPart, target) : null
}

export function patchedChart(
  parts: Map<string, Uint8Array>,
  chartPart: string,
  chart: ChartValue,
  ink?: ChartInk,
): boolean {
  const bytes = parts.get(chartPart)
  const before = bytes === undefined ? null : chartValueOf(bytes)
  if (bytes === undefined || before === null || before.kind !== chart.kind || chart.kind === "waterfall") return false
  const shaped = chartTree(shapePatched(bytes, before, chart) ?? undefined)
  const found = shaped === null ? null : dataEdits(shaped, chart)
  if (shaped === null || found === null) return false
  const looked = lookPatched(spliceBytes(shaped.bytes, found), lookBefore(before, chart), chart, ink)
  if (looked === null) return false
  const original = chartTree(bytes)
  const workbookPart = original === null ? null : linkedWorkbook(parts, chartPart, original)
  const workbookBytes = workbookPart === null ? undefined : parts.get(workbookPart)
  const workbook = workbookBytes === undefined ? null : syncedWorkbook(workbookBytes, bytes, looked)
  if (workbookPart !== null && workbook === null) return false
  parts.set(chartPart, looked)
  if (workbookPart !== null && workbook !== null && workbook !== workbookBytes) parts.set(workbookPart, workbook)
  return true
}

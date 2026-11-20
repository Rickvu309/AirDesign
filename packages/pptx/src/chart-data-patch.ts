import { sameColor, type ChartValue } from "@airdesign/document"
import { chartValueOf } from "./chart-read.js"
import { spanOf, unzipped } from "./chart-workbook-check.js"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { xmlAttribute, xmlText } from "./shape-write.js"
import { storedZip } from "./stored-zip.js"
import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"

type Parts = ReadonlyMap<string, Uint8Array>
type Read = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
}
type CellWrite = { readonly formula: string; readonly values: readonly (string | number)[] }

const groupKinds = ["c:barChart", "c:lineChart", "c:pieChart"]
const settingKeys = ["title", "labels", "axis", "gridlines", "gap", "legend"] as const

function read(bytes: Uint8Array | undefined): Read | null {
  if (bytes === undefined) return null
  try {
    const document = markupDocument(bytes)
    return document.wellFormed
      ? { bytes, elements: document.elements, children: markupChildren(document.elements) }
      : null
  } catch {
    return null
  }
}

function local(kind: string): string {
  return kind.slice(kind.indexOf(":") + 1)
}

function kids(markup: Read, parent: MarkupElement | undefined, name: string): readonly MarkupElement[] {
  return parent === undefined ? [] : (markup.children[parent.index] ?? []).filter((item) => local(item.kind) === name)
}

function kid(markup: Read, parent: MarkupElement | undefined, name: string): MarkupElement | undefined {
  return kids(markup, parent, name)[0]
}

function own(element: MarkupElement | undefined, name: string): string | undefined {
  return element?.attributes.find((item) => item.name === name)?.value
}

function sameLook(before: ChartValue, after: ChartValue): boolean {
  if (before.kind !== after.kind || before.categories.length !== after.categories.length) return false
  if (before.series.length !== after.series.length) return false
  if (settingKeys.some((key) => before[key] !== after[key])) return false
  return before.series.every((series, at) => sameColor(series.color, after.series[at]?.color))
}

function text(markup: Read, element: MarkupElement | undefined): string {
  if (element === undefined) return ""
  return holderText(markup.bytes, element)
}

type Holder = { readonly formula: string | null; readonly cache: MarkupElement }

function holderOf(markup: Read, parent: MarkupElement | undefined): Holder | null {
  const reference = kid(markup, parent, "strRef") ?? kid(markup, parent, "numRef")
  const cache =
    kid(markup, reference, "strCache") ??
    kid(markup, reference, "numCache") ??
    kid(markup, parent, "strLit") ??
    kid(markup, parent, "numLit")
  if (cache === undefined) return null
  const formula = kid(markup, reference, "f")
  return { formula: formula === undefined ? null : text(markup, formula), cache }
}

function pointEdits(markup: Read, holder: Holder, values: readonly (string | number)[]): readonly ByteEdit[] | null {
  const numeric = local(holder.cache.kind).startsWith("num")
  const edits: ByteEdit[] = []
  for (const [at, value] of values.entries()) {
    const point = kids(markup, holder.cache, "pt").find((each) => Number(own(each, "idx")) === at)
    const shown = kid(markup, point, "v")
    if (shown === undefined || shown.selfClosing) return null
    if (numeric && !Number.isFinite(Number(value))) return null
    edits.push({ start: shown.openEnd, end: shown.closeStart, next: encodeUtf8(xmlText(String(value))) })
  }
  return edits
}

function seriesEdits(markup: Read, chart: ChartValue): { edits: ByteEdit[]; cells: CellWrite[] } | null {
  const root = markup.elements.find((element) => element.parent < 0)
  const plot = kid(markup, kid(markup, root, "chart"), "plotArea")
  const group = (markup.children[plot?.index ?? -1] ?? []).find((element) => groupKinds.includes(element.kind))
  const listed = [...kids(markup, group, "ser")].sort(
    (left, right) =>
      Number(own(kid(markup, left, "order"), "val") ?? "0") - Number(own(kid(markup, right, "order"), "val") ?? "0"),
  )
  const edits: ByteEdit[] = []
  const cells: CellWrite[] = []
  for (const [at, series] of chart.series.entries()) {
    const element = listed[at]
    if (element === undefined) return null
    const tx = kid(markup, element, "tx")
    const direct = kid(markup, tx, "v")
    const parts: [Holder | null, readonly (string | number)[]][] = [
      [holderOf(markup, kid(markup, element, "cat")), chart.categories],
      [holderOf(markup, kid(markup, element, "val")), series.values],
    ]
    if (direct !== undefined && !direct.selfClosing)
      edits.push({ start: direct.openEnd, end: direct.closeStart, next: encodeUtf8(xmlText(series.name)) })
    else parts.push([holderOf(markup, tx), [series.name]])
    for (const [holder, values] of parts) {
      const patched = holder === null ? null : pointEdits(markup, holder, values)
      if (holder === null || patched === null) return null
      edits.push(...patched)
      if (holder.formula !== null) cells.push({ formula: holder.formula, values })
    }
  }
  return { edits, cells }
}

function cellXml(cell: MarkupElement, value: string | number): string {
  const reference = own(cell, "r") ?? ""
  const style = own(cell, "s")
  const styled = style === undefined ? "" : ` s="${xmlAttribute(style)}"`
  const numericCell = (own(cell, "t") ?? "n") === "n"
  if (typeof value === "string" && numericCell && value.trim() !== "" && Number.isFinite(Number(value)))
    return `<c r="${xmlAttribute(reference)}"${styled}><v>${String(Number(value))}</v></c>`
  if (typeof value === "number") return `<c r="${xmlAttribute(reference)}"${styled}><v>${String(value)}</v></c>`
  return `<c r="${xmlAttribute(reference)}"${styled} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`
}

function targets(rels: Read | null, owner: string): ReadonlyMap<string, { type: string; part: string }> {
  const found = new Map<string, { type: string; part: string }>()
  for (const row of rels?.elements ?? []) {
    const id = own(row, "Id")
    const target = own(row, "Target")
    if (
      local(row.kind) === "Relationship" &&
      id !== undefined &&
      target !== undefined &&
      own(row, "TargetMode") !== "External"
    )
      found.set(id, { type: own(row, "Type") ?? "", part: partOf(owner, target) })
  }
  return found
}

function sheetParts(files: Parts): ReadonlyMap<string, string> | null {
  const office = [...targets(read(files.get("_rels/.rels")), "").values()].find((row) =>
    row.type.endsWith("/officeDocument"),
  )
  const workbook = office === undefined ? null : read(files.get(office.part))
  if (office === undefined || workbook === null) return null
  const links = targets(read(files.get(relsOf(office.part))), office.part)
  const sheets = new Map<string, string>()
  for (const sheet of workbook.elements.filter((element) => local(element.kind) === "sheet")) {
    const id = sheet.attributes.find((item) => local(item.name) === "id" && item.name.includes(":"))?.value
    const part = id === undefined ? undefined : links.get(id)?.part
    const name = own(sheet, "name")
    if (name !== undefined && part !== undefined) sheets.set(name, part)
  }
  return sheets
}

function patchedWorkbook(bytes: Uint8Array, cells: readonly CellWrite[]): Uint8Array | null {
  const files = unzipped(bytes)
  const sheets = files === null ? null : sheetParts(files)
  if (files === null || sheets === null) return null
  const wanted = new Map<string, Map<string, string | number>>()
  for (const write of cells) {
    const span = spanOf(write.formula)
    const part = span === null ? undefined : sheets.get(span.sheet)
    if (span === null || part === undefined || span.cells.length !== write.values.length) return null
    const sheet = wanted.get(part) ?? new Map<string, string | number>()
    span.cells.forEach((cell, at) => sheet.set(cell, write.values[at] ?? ""))
    wanted.set(part, sheet)
  }
  const next = new Map(files)
  for (const [part, values] of wanted) {
    const sheet = read(files.get(part))
    if (sheet === null) return null
    const edits: ByteEdit[] = []
    for (const [reference, value] of values) {
      const cell = sheet.elements.find((element) => local(element.kind) === "c" && own(element, "r") === reference)
      if (cell === undefined || kid(sheet, cell, "f") !== undefined) return null
      edits.push({ start: cell.start, end: cell.end, next: encodeUtf8(cellXml(cell, value)) })
    }
    next.set(part, spliceBytes(sheet.bytes, edits))
  }
  return storedZip([...next])
}

function linkedWorkbook(parts: Parts, chartPart: string, markup: Read): string | null {
  const external = markup.elements.find((element) => element.kind === "c:externalData")
  const id = external?.attributes.find((item) => local(item.name) === "id" && item.name.includes(":"))?.value
  if (id === undefined) return null
  const link = targets(read(parts.get(relsOf(chartPart))), chartPart).get(id)
  return link !== undefined && link.type.endsWith("/package") ? link.part : null
}

export function patchedChartData(parts: Map<string, Uint8Array>, chartPart: string, chart: ChartValue): boolean {
  const bytes = parts.get(chartPart)
  const before = bytes === undefined ? null : chartValueOf(bytes)
  const markup = read(bytes)
  if (before === null || markup === null || !sameLook(before, chart)) return false
  const found = seriesEdits(markup, chart)
  if (found === null) return false
  const workbookPart = linkedWorkbook(parts, chartPart, markup)
  const workbookBytes = workbookPart === null ? undefined : parts.get(workbookPart)
  const workbook = workbookBytes === undefined ? null : patchedWorkbook(workbookBytes, found.cells)
  if (workbookPart !== null && workbook === null) return false
  parts.set(chartPart, spliceBytes(markup.bytes, found.edits))
  if (workbookPart !== null && workbook !== null) parts.set(workbookPart, workbook)
  return true
}

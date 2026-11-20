import {
  attributeSet,
  chartTree,
  removed,
  replaced,
  treeKid,
  treeKids,
  treeText,
  treeValue,
  type ChartTree,
} from "./chart-tree.js"
import { columnLetters, columnNumber, openBook, sameValue, spanOf, unzipped } from "./chart-workbook-check.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { xmlAttribute, xmlText } from "./shape-write.js"
import { storedZip } from "./stored-zip.js"

type Parts = ReadonlyMap<string, Uint8Array>
type Wanted = { readonly value: string; readonly numeric: boolean }
type Place = { readonly column: number; readonly row: number }
type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
type Cells = { readonly sheet: string; readonly cells: ReadonlyMap<string, Wanted> }

const holderKinds = new Map([
  ["c:strRef", "c:strCache"],
  ["c:numRef", "c:numCache"],
])
const cellReference = /^([A-Z]+)(\d+)$/

function placeOf(reference: string): Place | null {
  const found = cellReference.exec(reference)
  return found === null ? null : { column: columnNumber(found[1] ?? ""), row: Number(found[2]) }
}

function referenceOf(place: Place): string {
  return `${columnLetters(place.column)}${String(place.row)}`
}

export function chartCells(bytes: Uint8Array): Cells | null {
  const tree = chartTree(bytes)
  if (tree === null) return null
  const cells = new Map<string, Wanted>()
  let sheet: string | null = null
  for (const formula of tree.elements.filter((element) => element.kind === "c:f")) {
    const holder = tree.elements[formula.parent]
    const cacheKind = holder === undefined ? undefined : holderKinds.get(holder.kind)
    if (cacheKind === undefined) continue
    const span = spanOf(treeText(tree, formula))
    const cache = treeKid(tree, holder, cacheKind)
    if (span === null || cache === undefined || (sheet !== null && sheet !== span.sheet)) return null
    sheet = span.sheet
    const points = treeKids(tree, cache, "c:pt")
    for (const [at, reference] of span.cells.entries()) {
      const point = points.find((each) => treeValue(each, "idx") === String(at))
      const value = treeText(tree, treeKid(tree, point, "c:v"))
      cells.set(reference, { value, numeric: cacheKind === "c:numCache" })
    }
  }
  return sheet === null ? null : { sheet, cells }
}

function own(element: MarkupElement | undefined, name: string): string | undefined {
  return element?.attributes.find((item) => item.name === name)?.value
}

function local(kind: string): string {
  return kind.slice(kind.indexOf(":") + 1)
}

function targets(rels: ChartTree | null, owner: string): ReadonlyMap<string, { type: string; part: string }> {
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

function sheetPart(files: Parts, name: string): string | null {
  const office = [...targets(chartTree(files.get("_rels/.rels")), "").values()].find((row) =>
    row.type.endsWith("/officeDocument"),
  )
  const workbook = office === undefined ? null : chartTree(files.get(office.part))
  if (office === undefined || workbook === null) return null
  const links = targets(chartTree(files.get(relsOf(office.part))), office.part)
  const sheet = workbook.elements.find((element) => local(element.kind) === "sheet" && own(element, "name") === name)
  const id = sheet?.attributes.find((item) => local(item.name) === "id" && item.name.includes(":"))?.value
  return (id === undefined ? undefined : links.get(id)?.part) ?? null
}

function cellXml(reference: string, style: string | undefined, wanted: Wanted): string {
  const styled = style === undefined ? "" : ` s="${xmlAttribute(style)}"`
  const number = Number(wanted.value)
  if (wanted.numeric && wanted.value.trim() !== "" && Number.isFinite(number))
    return `<c r="${reference}"${styled}><v>${String(number)}</v></c>`
  return `<c r="${reference}"${styled} t="inlineStr"><is><t xml:space="preserve">${xmlText(wanted.value)}</t></is></c>`
}

function boxOf(references: Iterable<string>): Box | null {
  let box: Box | null = null
  for (const reference of references) {
    const place = placeOf(reference)
    if (place === null) continue
    box =
      box === null
        ? { left: place.column, top: place.row, right: place.column, bottom: place.row }
        : {
            left: Math.min(box.left, place.column),
            top: Math.min(box.top, place.row),
            right: Math.max(box.right, place.column),
            bottom: Math.max(box.bottom, place.row),
          }
  }
  return box
}

function rangeOf(box: Box): string {
  return `${referenceOf({ column: box.left, row: box.top })}:${referenceOf({ column: box.right, row: box.bottom })}`
}

type SheetCell = { readonly element: MarkupElement; readonly place: Place }

function styleLike(existing: ReadonlyMap<string, SheetCell>, place: Place, kept: (reference: string) => boolean) {
  for (let row = place.row - 1; row >= 1; row -= 1) {
    const reference = referenceOf({ column: place.column, row })
    const found = existing.get(reference)
    if (found !== undefined && kept(reference)) return own(found.element, "s")
  }
  for (let column = place.column - 1; column >= 1; column -= 1) {
    const found = existing.get(referenceOf({ column, row: place.row }))
    if (found !== undefined) return own(found.element, "s")
  }
  return undefined
}

function sheetEdits(
  sheet: ChartTree,
  writes: ReadonlyMap<string, Wanted>,
  clears: ReadonlySet<string>,
): { readonly edits: ByteEdit[]; readonly present: readonly string[] } | null {
  const existing = new Map<string, SheetCell>()
  const rows = new Map<number, MarkupElement>()
  for (const element of sheet.elements) {
    if (local(element.kind) === "row") rows.set(Number(own(element, "r")), element)
    const place = local(element.kind) === "c" ? placeOf(own(element, "r") ?? "") : null
    if (place !== null) existing.set(referenceOf(place), { element, place })
  }
  const data = sheet.elements.find((element) => local(element.kind) === "sheetData")
  if (data === undefined) return null
  const edits: ByteEdit[] = []
  const added = new Map<number, Map<number, string[]>>()
  const addedRows = new Map<number, string[]>()
  for (const [reference, wanted] of writes) {
    const found = existing.get(reference)
    const place = placeOf(reference)
    if (place === null) return null
    if (found !== undefined) {
      if (treeKid(sheet, found.element, "f") !== undefined) return null
      edits.push(replaced(found.element, cellXml(reference, own(found.element, "s"), wanted)))
      continue
    }
    const xml = cellXml(
      reference,
      styleLike(existing, place, (each) => !clears.has(each)),
      wanted,
    )
    const row = rows.get(place.row)
    if (row === undefined) {
      addedRows.set(place.row, [...(addedRows.get(place.row) ?? []), `${String(place.column).padStart(6, "0")}${xml}`])
      continue
    }
    const next = [...existing.values()]
      .filter(
        (cell) =>
          cell.place.row === place.row && cell.place.column > place.column && !clears.has(referenceOf(cell.place)),
      )
      .sort((left, right) => left.place.column - right.place.column)[0]
    const anchor = next === undefined ? -1 : next.element.start
    const byAnchor = added.get(place.row) ?? new Map<number, string[]>()
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), `${String(place.column).padStart(6, "0")}${xml}`])
    added.set(place.row, byAnchor)
  }
  const ordered = (items: readonly string[]) =>
    [...items]
      .sort()
      .map((item) => item.slice(6))
      .join("")
  for (const [number, byAnchor] of added) {
    const row = rows.get(number)
    if (row === undefined) return null
    for (const [anchor, items] of byAnchor) {
      if (anchor >= 0) edits.push({ start: anchor, end: anchor, next: encodeUtf8(ordered(items)) })
      else if (row.selfClosing) {
        const open = decodeUtf8(sheet.bytes.subarray(row.start, row.end - 2)).trimEnd()
        edits.push({ start: row.start, end: row.end, next: encodeUtf8(`${open}>${ordered(items)}</row>`) })
      } else edits.push({ start: row.closeStart, end: row.closeStart, next: encodeUtf8(ordered(items)) })
    }
  }
  const rowAnchors = new Map<number, string[]>()
  for (const [number, items] of [...addedRows].sort(([left], [right]) => left - right)) {
    const after = [...rows].filter(([at]) => at > number).sort(([left], [right]) => left - right)[0]
    const anchor = after === undefined ? data.closeStart : after[1].start
    rowAnchors.set(anchor, [...(rowAnchors.get(anchor) ?? []), `<row r="${String(number)}">${ordered(items)}</row>`])
  }
  for (const [anchor, items] of rowAnchors) {
    if (data.selfClosing) return null
    edits.push({ start: anchor, end: anchor, next: encodeUtf8(items.join("")) })
  }
  for (const reference of clears) {
    const found = existing.get(reference)
    if (found !== undefined && !writes.has(reference)) edits.push(removed(found.element))
  }
  const present = [...new Set([...existing.keys(), ...writes.keys()])].filter(
    (reference) => !clears.has(reference) || writes.has(reference),
  )
  const dimension = sheet.elements.find((element) => local(element.kind) === "dimension")
  const box = boxOf(present)
  if (dimension !== undefined && box !== null) edits.push(attributeSet(sheet, dimension, "ref", rangeOf(box)))
  return { edits, present }
}

function tableEdits(
  table: ChartTree,
  before: Box,
  after: Box,
  header: (column: number) => string,
): readonly ByteEdit[] {
  const root = table.elements.find((element) => element.parent < 0)
  if (root === undefined || own(root, "ref") !== rangeOf(before)) return []
  const edits: ByteEdit[] = [attributeSet(table, root, "ref", rangeOf(after))]
  const filter = (table.children[root.index] ?? []).find((element) => local(element.kind) === "autoFilter")
  if (filter !== undefined && own(filter, "ref") === rangeOf(before))
    edits.push(attributeSet(table, filter, "ref", rangeOf(after)))
  const list = (table.children[root.index] ?? []).find((element) => local(element.kind) === "tableColumns")
  if (list === undefined || list.selfClosing) return edits
  const columns = (table.children[list.index] ?? []).filter((element) => local(element.kind) === "tableColumn")
  const width = after.right - after.left + 1
  const ids = columns.map((column) => Number(own(column, "id") ?? "0"))
  let next = Math.max(0, ...ids)
  const added: string[] = []
  for (let at = 0; at < width; at += 1) {
    const name = header(after.left + at)
    const column = columns[at]
    if (column === undefined) {
      next += 1
      added.push(`<tableColumn id="${String(next)}" name="${xmlAttribute(name)}"/>`)
    } else if (own(column, "name") !== name) edits.push(attributeSet(table, column, "name", name))
  }
  for (const column of columns.slice(width)) edits.push(removed(column))
  if (added.length > 0) edits.push({ start: list.closeStart, end: list.closeStart, next: encodeUtf8(added.join("")) })
  if (columns.length !== width) edits.push(attributeSet(table, list, "count", String(width)))
  return edits
}

export function syncedWorkbook(workbook: Uint8Array, before: Uint8Array, after: Uint8Array): Uint8Array | null {
  const [was, now] = [chartCells(before), chartCells(after)]
  const files = unzipped(workbook)
  const book = openBook(workbook)
  if (was === null || now === null || files === null || book === null || was.sheet !== now.sheet) return null
  const writes = new Map<string, Wanted>()
  for (const [reference, wanted] of now.cells) {
    const held = book.cell(now.sheet, reference)
    if (held === undefined) return null
    if (!sameValue(held, wanted.value, wanted.numeric)) writes.set(reference, wanted)
  }
  const clears = new Set([...was.cells.keys()].filter((reference) => !now.cells.has(reference)))
  const [oldBox, newBox] = [boxOf(was.cells.keys()), boxOf(now.cells.keys())]
  const boxMoved = oldBox === null || newBox === null || rangeOf(oldBox) !== rangeOf(newBox)
  if (writes.size === 0 && clears.size === 0) return workbook
  const part = sheetPart(files, now.sheet)
  const sheet = part === null ? null : chartTree(files.get(part))
  if (part === null || sheet === null) return null
  const changed = sheetEdits(sheet, writes, clears)
  if (changed === null) return null
  const next = new Map(files)
  next.set(part, spliceBytes(sheet.bytes, changed.edits))
  const header = (column: number) => {
    const reference = referenceOf({ column, row: newBox?.top ?? 1 })
    const held = now.cells.get(reference)?.value ?? book.cell(now.sheet, reference)
    return held === null || held === undefined || held === "" ? `Column${String(column)}` : String(held)
  }
  const tableLinks = [...targets(chartTree(files.get(relsOf(part))), part).values()].filter((row) =>
    row.type.endsWith("/table"),
  )
  for (const link of tableLinks) {
    const table = chartTree(files.get(link.part))
    if (table === null || oldBox === null || newBox === null) continue
    const edits = boxMoved || writes.size > 0 ? tableEdits(table, oldBox, newBox, header) : []
    if (edits.length > 0) next.set(link.part, spliceBytes(table.bytes, edits))
  }
  return storedZip([...next])
}

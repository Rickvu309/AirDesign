import { holderText, markupChildren, type MarkupChildren } from "./text-value-route.js"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { ContainerError, partData, readContainer } from "./package-container.js"

type Parts = ReadonlyMap<string, Uint8Array>
type Read = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
}
type Cell = string | number
type Book = { readonly cell: (sheet: string, reference: string) => Cell | null | undefined }

const chartPart = /^ppt\/charts\/[^/]+\.xml$/
const formulaPattern = /^(?:'((?:[^']|'')+)'|([^'![\]]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/
const closeEnough = 1e-9

function read(bytes: Uint8Array | undefined): Read | null {
  if (bytes === undefined) return null
  try {
    const document = markupDocument(bytes)
    if (!document.wellFormed) return null
    return { bytes, elements: document.elements, children: markupChildren(document.elements) }
  } catch {
    return null
  }
}

function local(kind: string): string {
  return kind.slice(kind.indexOf(":") + 1)
}

function own(element: MarkupElement, name: string): string | undefined {
  return element.attributes.find((item) => item.name === name)?.value
}

function relationshipId(element: MarkupElement): string | undefined {
  return element.attributes.find((item) => local(item.name) === "id" && item.name.includes(":"))?.value
}

function kids(markup: Read, parent: MarkupElement | undefined, name: string): readonly MarkupElement[] {
  return parent === undefined ? [] : (markup.children[parent.index] ?? []).filter((item) => local(item.kind) === name)
}

function textOf(markup: Read, element: MarkupElement | undefined): string {
  return holderText(markup.bytes, element)
}

function targets(rels: Read | null, owner: string): ReadonlyMap<string, { type: string; part: string }> {
  const found = new Map<string, { type: string; part: string }>()
  for (const row of rels?.elements ?? []) {
    if (local(row.kind) !== "Relationship" || own(row, "TargetMode") === "External") continue
    const id = own(row, "Id")
    const target = own(row, "Target")
    if (id !== undefined && target !== undefined)
      found.set(id, { type: own(row, "Type") ?? "", part: partOf(owner, target) })
  }
  return found
}

export function unzipped(bytes: Uint8Array): Parts | null {
  try {
    const files = new Map<string, Uint8Array>()
    for (const record of readContainer(bytes)) {
      if (record.directory) continue
      const data = partData(record)
      if (data === undefined) return null
      files.set(record.name, data)
    }
    return files
  } catch (error) {
    if (error instanceof ContainerError) return null
    throw error
  }
}

function sharedStrings(markup: Read | null): readonly string[] {
  if (markup === null) return []
  const root = markup.elements.find((element) => element.parent < 0)
  return kids(markup, root, "si").map((item) => {
    const direct = kids(markup, item, "t")
    const runs = kids(markup, item, "r").flatMap((run) => kids(markup, run, "t"))
    return [...direct, ...runs]
      .sort((left, right) => left.start - right.start)
      .map((text) => textOf(markup, text))
      .join("")
  })
}

function sheetCells(markup: Read | null, strings: readonly string[]): ReadonlyMap<string, Cell> {
  const cells = new Map<string, Cell>()
  for (const element of markup?.elements ?? []) {
    if (local(element.kind) !== "c" || markup === null) continue
    const reference = own(element, "r")
    if (reference === undefined) continue
    const type = own(element, "t") ?? "n"
    const value = textOf(markup, kids(markup, element, "v")[0])
    if (type === "s") cells.set(reference, strings[Number(value)] ?? "")
    else if (type === "inlineStr")
      cells.set(
        reference,
        kids(markup, kids(markup, element, "is")[0], "t")
          .map((text) => textOf(markup, text))
          .join(""),
      )
    else if (type === "n" && value !== "") cells.set(reference, Number(value))
    else cells.set(reference, value)
  }
  return cells
}

function openBook(bytes: Uint8Array): Book | null {
  const files = unzipped(bytes)
  if (files === null) return null
  const office = [...targets(read(files.get("_rels/.rels")), "").values()].find((row) =>
    row.type.endsWith("/officeDocument"),
  )
  const workbook = office === undefined ? null : read(files.get(office.part))
  if (office === undefined || workbook === null) return null
  const links = targets(read(files.get(relsOf(office.part))), office.part)
  const stringsPart = [...links.values()].find((row) => row.type.endsWith("/sharedStrings"))
  const strings = sharedStrings(stringsPart === undefined ? null : read(files.get(stringsPart.part)))
  const sheets = new Map<string, string>()
  for (const sheet of workbook.elements.filter((element) => local(element.kind) === "sheet")) {
    const name = own(sheet, "name")
    const id = relationshipId(sheet)
    const target = id === undefined ? undefined : links.get(id)?.part
    if (name !== undefined && target !== undefined) sheets.set(name, target)
  }
  const cached = new Map<string, ReadonlyMap<string, Cell>>()
  return {
    cell(sheet, reference) {
      const part = sheets.get(sheet)
      if (part === undefined) return undefined
      let cells = cached.get(part)
      if (cells === undefined) {
        cells = sheetCells(read(files.get(part)), strings)
        cached.set(part, cells)
      }
      return cells.get(reference) ?? null
    },
  }
}

function columnNumber(name: string): number {
  let number = 0
  for (const letter of name) number = number * 26 + (letter.charCodeAt(0) - 64)
  return number
}

function columnLetters(number: number): string {
  let rest = number
  let name = ""
  while (rest > 0) {
    name = String.fromCharCode(65 + ((rest - 1) % 26)) + name
    rest = Math.floor((rest - 1) / 26)
  }
  return name
}

export type Span = { readonly sheet: string; readonly cells: readonly string[] }

export function spanOf(formula: string): Span | null {
  const found = formulaPattern.exec(formula.trim())
  if (found === null) return null
  const [, quoted, plain, fromColumn = "", fromRow = "", toColumn, toRow] = found
  const sheet = quoted === undefined ? (plain ?? "") : quoted.replaceAll("''", "'")
  const left = columnNumber(fromColumn)
  const right = toColumn === undefined ? left : columnNumber(toColumn)
  const top = Number(fromRow)
  const bottom = toRow === undefined ? top : Number(toRow)
  if (left !== right && top !== bottom) return null
  const cells: string[] = []
  for (let column = Math.min(left, right); column <= Math.max(left, right); column += 1)
    for (let row = Math.min(top, bottom); row <= Math.max(top, bottom); row += 1)
      cells.push(`${columnLetters(column)}${String(row)}`)
  return { sheet, cells }
}

function sameValue(cell: Cell | null, cache: string, numeric: boolean): boolean {
  if (cell === null) return cache === ""
  const wanted = Number(cache)
  if (typeof cell === "number") {
    if (cache.trim() === "" || !Number.isFinite(wanted)) return !numeric
    return Math.abs(cell - wanted) <= closeEnough * Math.max(1, Math.abs(wanted))
  }
  if (cell === cache) return true
  return numeric && cell.trim() !== "" && Number(cell) === wanted
}

function formulaErrors(chart: Read, part: string, book: Book, formula: MarkupElement): readonly string[] {
  const holder = chart.elements[formula.parent]
  const span = spanOf(textOf(chart, formula))
  if (holder === undefined || span === null) return []
  const numeric = local(holder.kind) === "numRef"
  const cache = kids(chart, holder, numeric ? "numCache" : "strCache")[0]
  if (cache === undefined) return []
  const count = Number(own(kids(chart, cache, "ptCount")[0] ?? holder, "val") ?? "0")
  const where = `/${part} ${textOf(chart, formula)}`
  if (count !== span.cells.length)
    return [`Chart workbook: ${where} spans ${String(span.cells.length)} cells, its cache ${String(count)}`]
  const errors: string[] = []
  for (const point of kids(chart, cache, "pt")) {
    const at = Number(own(point, "idx"))
    const reference = span.cells[at]
    if (reference === undefined) continue
    const cell = book.cell(span.sheet, reference)
    if (cell === undefined) return [`Chart workbook: ${where} names a sheet the workbook lacks`]
    const value = textOf(chart, kids(chart, point, "v")[0])
    if (!sameValue(cell, value, numeric))
      errors.push(
        `Chart workbook: ${where} cell ${reference} holds ${cell === null ? "nothing" : String(cell)}, its cache ${value}`,
      )
  }
  return errors
}

function chartErrors(parts: Parts, part: string, bytes: Uint8Array): readonly string[] {
  const chart = read(bytes)
  const external = chart?.elements.find((element) => element.kind === "c:externalData")
  const id = external === undefined ? undefined : relationshipId(external)
  if (chart === null || id === undefined) return []
  const link = targets(read(parts.get(relsOf(part))), part).get(id)
  if (link === undefined || !link.type.endsWith("/package")) return []
  const workbook = parts.get(link.part)
  if (workbook === undefined) return [`Chart workbook: /${part} links /${link.part}, which is missing`]
  const book = openBook(workbook)
  if (book === null) return [`Chart workbook: /${link.part} does not open as a workbook`]
  return chart.elements
    .filter((element) => element.kind === "c:f")
    .flatMap((formula) => formulaErrors(chart, part, book, formula))
}

export function chartWorkbookErrors(parts: Parts): readonly string[] {
  const errors: string[] = []
  for (const [part, bytes] of parts) if (chartPart.test(part)) errors.push(...chartErrors(parts, part, bytes))
  return errors
}

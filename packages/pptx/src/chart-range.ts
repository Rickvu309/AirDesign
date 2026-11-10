import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, readParts } from "./package-bytes.js"

const chartPart = /^ppt\/charts\/chart\d+\.xml$/
const maxColumn = 16384
const maxRow = 1048576

type Cell = {
  column: number
  row: number
}

type Area = {
  sheet: string
  start: Cell
  end: Cell
}

function localName(kind: string): string {
  let separator = -1
  for (let index = 0; index < kind.length; index += 1) if (kind[index] === ":") separator = index
  return separator < 0 ? kind : kind.slice(separator + 1)
}

function attribute(element: MarkupElement, name: string): string | null {
  for (const item of element.attributes) if (item.name === name) return item.value
  return null
}

function elementText(bytes: Uint8Array, element: MarkupElement): string {
  if (element.selfClosing || element.closeStart < element.openEnd) return ""
  return decodeUtf8(bytes.subarray(element.openEnd, element.closeStart))
}

function isLetter(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57
}

function skipSpaces(text: string, start: number): number {
  let index = start
  while (text[index] === " ") index += 1
  return index
}

function parseColumn(text: string, start: number): { value: number; next: number } | null {
  let index = start
  let value = 0
  let width = 0
  while (index < text.length && isLetter(text.charCodeAt(index))) {
    const code = text.charCodeAt(index)
    value = value * 26 + ((code >= 97 ? code - 32 : code) - 64)
    width += 1
    if (width > 3 || value > maxColumn) return null
    index += 1
  }
  if (width === 0) return null
  return { value, next: index }
}

function parseNumber(text: string, start: number, max: number): { value: number; next: number } | null {
  let index = start
  if (!isDigit(text.charCodeAt(index))) return null
  let value = 0
  while (index < text.length && isDigit(text.charCodeAt(index))) {
    value = value * 10 + (text.charCodeAt(index) - 48)
    if (value > max) return null
    index += 1
  }
  if (value < 1) return null
  return { value, next: index }
}

function parseCell(text: string, start: number): (Cell & { next: number }) | null {
  let index = skipSpaces(text, start)
  if (text[index] === "$") index += 1
  const column = parseColumn(text, index)
  if (column === null) return null
  index = column.next
  if (text[index] === "$") index += 1
  const row = parseNumber(text, index, maxRow)
  if (row === null) return null
  return { column: column.value, row: row.value, next: row.next }
}

function parseSheet(formula: string): { sheet: string; rest: string } | null {
  if (formula.startsWith("'")) {
    let sheet = ""
    let index = 1
    while (index < formula.length) {
      const char = formula[index]
      if (char === "'") {
        if (formula[index + 1] === "'") {
          sheet += "'"
          index += 2
          continue
        }
        index += 1
        break
      }
      if (char === undefined) return null
      sheet += char
      index += 1
    }
    if (sheet.length === 0 || formula[index] !== "!") return null
    return { sheet, rest: formula.slice(index + 1) }
  }
  let sheet = ""
  let index = 0
  while (index < formula.length && formula[index] !== "!") {
    const char = formula[index]
    if (char === undefined) return null
    sheet += char
    index += 1
  }
  if (sheet.length === 0 || formula[index] !== "!") return null
  return { sheet, rest: formula.slice(index + 1) }
}

function parseFormula(formula: string): Area | null {
  const text = formula.trim()
  if (text.length === 0 || text.includes("[") || text.includes("&") || text.includes("=")) return null
  const sheet = parseSheet(text)
  if (sheet === null) return null
  const start = parseCell(sheet.rest, 0)
  if (start === null) return null
  let index = skipSpaces(sheet.rest, start.next)
  let endColumn = start.column
  let endRow = start.row
  if (sheet.rest[index] === ":") {
    const end = parseCell(sheet.rest, index + 1)
    if (end === null) return null
    endColumn = end.column
    endRow = end.row
    index = skipSpaces(sheet.rest, end.next)
  }
  if (index !== sheet.rest.length) return null
  return {
    sheet: sheet.sheet,
    start: {
      column: Math.min(start.column, endColumn),
      row: Math.min(start.row, endRow),
    },
    end: {
      column: Math.max(start.column, endColumn),
      row: Math.max(start.row, endRow),
    },
  }
}

function relsPart(part: string): string {
  const pieces = part.split("/")
  const file = pieces[pieces.length - 1]
  if (file === undefined) return part
  pieces[pieces.length - 1] = "_rels"
  pieces.push(`${file}.rels`)
  return pieces.join("/")
}

function resolveTarget(part: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1)
  const base = part.split("/").filter((piece) => piece.length > 0)
  base.pop()
  for (const piece of target.split("/")) {
    if (piece.length === 0 || piece === ".") continue
    if (piece === "..") base.pop()
    else base.push(piece)
  }
  return base.join("/")
}

function packageTarget(elements: readonly MarkupElement[]): string | null {
  for (const element of elements) {
    if (localName(element.kind) !== "Relationship") continue
    if (attribute(element, "TargetMode") === "External") continue
    const type = attribute(element, "Type")
    const target = attribute(element, "Target")
    if (type === null || target === null || !type.endsWith("/package")) continue
    return target
  }
  return null
}

function worksheetTarget(elements: readonly MarkupElement[], id: string): string | null {
  for (const element of elements) {
    if (localName(element.kind) !== "Relationship") continue
    if (attribute(element, "Id") !== id || attribute(element, "TargetMode") === "External") continue
    const type = attribute(element, "Type")
    const target = attribute(element, "Target")
    if (type === null || target === null || !type.endsWith("/worksheet")) continue
    return target
  }
  return null
}

function cellsOf(bytes: Uint8Array): Set<string> {
  const cells = new Set<string>()
  for (const element of markupDocument(bytes).elements) {
    if (localName(element.kind) !== "c") continue
    const ref = attribute(element, "r")
    if (ref === null) continue
    const cell = parseCell(ref, 0)
    if (cell === null || skipSpaces(ref, cell.next) !== ref.length) continue
    cells.add(`${cell.column}:${cell.row}`)
  }
  return cells
}

function sheetCells(parts: ReadonlyMap<string, Uint8Array>): Map<string, Set<string>> {
  const book = parts.get("xl/workbook.xml")
  const rels = parts.get("xl/_rels/workbook.xml.rels")
  const sheets = new Map<string, Set<string>>()
  if (book === undefined || rels === undefined) return sheets
  const relationships = markupDocument(rels).elements
  for (const element of markupDocument(book).elements) {
    if (localName(element.kind) !== "sheet") continue
    const name = attribute(element, "name")
    const id = attribute(element, "r:id")
    if (name === null || id === null) continue
    const target = worksheetTarget(relationships, id)
    if (target === null) continue
    const sheet = parts.get(resolveTarget("xl/workbook.xml", target))
    if (sheet === undefined) continue
    sheets.set(name, cellsOf(sheet))
  }
  return sheets
}

async function workbookCells(
  parts: ReadonlyMap<string, Uint8Array>,
  chart: string,
): Promise<ReadonlyMap<string, ReadonlySet<string>> | null> {
  const rels = parts.get(relsPart(chart))
  if (rels === undefined) return null
  const target = packageTarget(markupDocument(rels).elements)
  if (target === null) return null
  const book = parts.get(resolveTarget(chart, target))
  if (book === undefined) return null
  return sheetCells(await readParts(book))
}

function findSheet(sheets: ReadonlyMap<string, ReadonlySet<string>>, name: string): ReadonlySet<string> | undefined {
  const wanted = name.toLowerCase()
  for (const [sheet, cells] of sheets) if (sheet.toLowerCase() === wanted) return cells
  return undefined
}

function cellKey(key: string): Cell | null {
  let colon = -1
  for (let index = 0; index < key.length; index += 1) if (key[index] === ":") colon = index
  if (colon < 0) return null
  const column = Number(key.slice(0, colon))
  const row = Number(key.slice(colon + 1))
  if (!Number.isInteger(column) || !Number.isInteger(row)) return null
  return { column, row }
}

function outside(sheets: ReadonlyMap<string, ReadonlySet<string>>, area: Area): boolean {
  const cells = findSheet(sheets, area.sheet)
  if (cells === undefined) return true
  for (const key of cells) {
    const cell = cellKey(key)
    if (cell === null) continue
    if (
      cell.column >= area.start.column &&
      cell.column <= area.end.column &&
      cell.row >= area.start.row &&
      cell.row <= area.end.row
    ) {
      return false
    }
  }
  return true
}

export async function chartRangeFaults(parts: ReadonlyMap<string, Uint8Array>): Promise<readonly string[]> {
  const faults: string[] = []
  for (const [name, bytes] of parts) {
    if (!chartPart.test(name)) continue
    const book = await workbookCells(parts, name)
    if (book === null) continue
    const parsed = markupDocument(bytes)
    for (const element of parsed.elements) {
      if (localName(element.kind) !== "f") continue
      const formula = elementText(bytes, element).trim()
      const area = parseFormula(formula)
      if (area === null) continue
      if (outside(book, area)) faults.push(`${name} formula ${formula} points outside the workbook`)
    }
  }
  return faults
}

import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, readParts } from "./package-bytes.js"

const chartPart = /^ppt\/charts\/chart\d+\.xml$/

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

function xmlText(value: string): string {
  let text = ""
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "&") continue
    let end = index + 1
    while (end < value.length && value[end] !== ";") end += 1
    if (end >= value.length) break
    const token = value.slice(index + 1, end)
    const decoded =
      token === "amp"
        ? "&"
        : token === "lt"
          ? "<"
          : token === "gt"
            ? ">"
            : token === "quot"
              ? '"'
              : token === "apos"
                ? "'"
                : null
    if (decoded === null) continue
    text += value.slice(start, index) + decoded
    start = end + 1
    index = end
  }
  return text + value.slice(start)
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
    if (width > 3 || value > 16384) return null
    index += 1
  }
  if (width === 0) return null
  return { value, next: index }
}

function parseNumber(text: string, start: number): { value: number; next: number } | null {
  let index = start
  if (!isDigit(text.charCodeAt(index))) return null
  let value = 0
  while (index < text.length && isDigit(text.charCodeAt(index))) {
    value = value * 10 + (text.charCodeAt(index) - 48)
    if (!Number.isSafeInteger(value)) return null
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
  const row = parseNumber(text, index)
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
  let text = formula.trim()
  if (text.startsWith("=")) text = text.slice(1).trim()
  if (text.startsWith("[")) {
    let index = 1
    while (index < text.length && text[index] !== "]") index += 1
    if (text[index] !== "]") return null
    text = text.slice(index + 1)
  }
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

function areaSize(area: Area): number {
  return (area.end.column - area.start.column + 1) * (area.end.row - area.start.row + 1)
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

function covers(sheets: ReadonlyMap<string, ReadonlySet<string>>, area: Area): boolean {
  const cells = findSheet(sheets, area.sheet)
  if (cells === undefined) return false
  const width = area.end.column - area.start.column + 1
  const height = area.end.row - area.start.row + 1
  if (width > cells.size || height > cells.size || width * height > cells.size) return false
  for (let column = area.start.column; column <= area.end.column; column += 1) {
    for (let row = area.start.row; row <= area.end.row; row += 1) {
      if (!cells.has(`${column}:${row}`)) return false
    }
  }
  return true
}

function cachedPoints(elements: readonly MarkupElement[], formula: MarkupElement): number | null {
  let cache: MarkupElement | null = null
  for (const element of elements) {
    if (element.parent !== formula.parent || !localName(element.kind).endsWith("Cache")) continue
    cache = element
  }
  if (cache === null) return null
  let counted: number | null = null
  let points = 0
  for (const element of elements) {
    if (element.parent !== cache.index) continue
    const name = localName(element.kind)
    if (name === "pt") points += 1
    if (name !== "ptCount") continue
    const value = attribute(element, "val")
    if (value === null) continue
    const parsed = parseNumber(value, 0)
    if (parsed !== null && skipSpaces(value, parsed.next) === value.length) counted = parsed.value
  }
  if (counted !== null) return counted
  return points > 0 ? points : null
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
      const formula = xmlText(elementText(bytes, element)).trim()
      const area = parseFormula(formula)
      if (area === null) continue
      if (!covers(book, area)) {
        faults.push(`${name} formula ${formula} points outside the workbook`)
        continue
      }
      const cached = cachedPoints(parsed.elements, element)
      if (cached !== null && cached !== areaSize(area)) {
        faults.push(`${name} formula ${formula} cached points do not match`)
      }
    }
  }
  return faults
}

import type { Doom, Node } from "./doom.js"
import { childrenOf, propOf } from "./doom-walk.js"
import { cellsOf } from "./solve-layout.js"

type Cell = { readonly kind: "measure"; readonly unit: string } | { readonly kind: "label" | "text" | "empty" }

const amount = /^[(\-−+]?([$€£¥]?)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(%|x|[kmb]n?|pts?|pp)?\)?$/i
const year = /^(?:19|20)\d{2}$/
const code = /^0\d|^\d{5,}$/
const phone = /^\+?(?=(?:\D*\d){7})[\d\s().-]+$/
const labelHeader =
  /\b(?:ids?|codes?|phones?|tel|fax|zip|post(?:al)?\s*code|sku|ext|extension|rank)\b|^(?:#|no\.?|step|order)$/i
const priceHeader = /\b(?:prices?|pricing|fees?|rate card)\b/i
const time =
  /^(?:(?:19|20)\d{2}[EAFPB]?|(?:Q[1-4]|H[12])(?:\s*(?:FY\s?'?)?\d{2,4})?|FY\s?'?\d{2,4}[EAFPB]?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+'?\d{2,4})?)$/i
const total = /^(?:total|sum|overall|grand total|all)\b/i
const reference = /^\s*(?:appendix|reference|back-?up)\b/i

const unitOf = (currency: string, suffix: string) =>
  currency + (suffix === "%" ? "%" : suffix.toLowerCase() === "x" ? "x" : /^(?:pts?|pp)$/i.test(suffix) ? "pts" : "")

function cellOf(chars: string, labelled: boolean): Cell {
  if (chars === "") return { kind: "empty" }
  const found = amount.exec(chars)
  if (found === null) return { kind: phone.test(chars) ? "label" : "text" }
  if (labelled || year.test(chars) || code.test(chars)) return { kind: "label" }
  return { kind: "measure", unit: unitOf(found[1] ?? "", found[2] ?? "") }
}

function tableOf(doom: Doom, node: Node): readonly (readonly string[])[] | undefined {
  const layout = propOf(node, "layout")
  if (layout?.mode !== "grid") return undefined
  const shown = childrenOf(doom, node.id).filter(
    (cell) => propOf(cell, "hidden") !== true && propOf(cell, "absolute") !== true,
  )
  const rows: string[][] = []
  for (const { node: cell, row, col } of cellsOf(layout, shown)) {
    rows[row] ??= []
    rows[row][col] = propOf(cell, "text")?.chars.trim() ?? ""
  }
  return Array.from(rows, (row) => Array.from(row ?? [], (chars) => chars ?? ""))
}

const crossHeader = (chars: string) =>
  chars !== "" && !total.test(chars) && (time.test(chars) || amount.exec(chars) === null)

function seriesLength(values: readonly Cell[], headers: readonly string[]): number {
  const units = new Map<string, Set<string>>()
  for (const [index, cell] of values.entries()) {
    const header = headers[index] ?? ""
    if (cell.kind !== "measure" || !crossHeader(header)) continue
    units.set(cell.unit, (units.get(cell.unit) ?? new Set()).add(header))
  }
  const longest = Math.max(0, ...[...units.values()].map((headers) => headers.size))
  return longest >= 3 ? longest : 0
}

export function chartSeries(doom: Doom, node: Node): number {
  const rows = tableOf(doom, node)
  if (rows === undefined || rows.length < 2) return 0
  const columns = Array.from({ length: Math.max(...rows.map((row) => row.length)) - 1 }, (_, col) => col + 1)
  const heads = columns.map((col) => rows[0]?.[col] ?? "")
  const names = rows.slice(1).map((row) => row[0] ?? "")
  if ([...heads, ...names, rows[0]?.[0] ?? ""].some((header) => priceHeader.test(header))) return 0
  const body = names.map((name, row) =>
    columns.map((col, index) =>
      cellOf(rows[row + 1]?.[col] ?? "", labelHeader.test(name) || labelHeader.test(heads[index] ?? "")),
    ),
  )
  const cells = body.flat()
  if (cells.filter(({ kind }) => kind === "label").length >= cells.filter(({ kind }) => kind === "measure").length)
    return 0
  return [
    ...heads.map((_, index) =>
      seriesLength(
        body.map((row) => row[index]!),
        names,
      ),
    ),
    ...body.map((row) => seriesLength(row, heads)),
  ].reduce((sum, length) => sum + length, 0)
}

export const isReference = (texts: readonly string[]) => texts.some((chars) => reference.test(chars))

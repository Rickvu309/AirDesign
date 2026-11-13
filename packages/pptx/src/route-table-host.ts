import type { MarkupElement } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import type { StructuralEdit } from "./structural-route.js"
import { gridOf } from "./table-grid.js"

export type TableEdit = Extract<
  StructuralEdit,
  { readonly name: "tbl.addRow" | "tbl.removeRow" | "tbl.orderRow" | "tbl.addColumn" | "tbl.removeColumn" }
>

function rowBytes(bytes: Uint8Array): Uint8Array[] {
  return requireMarkup(bytes)
    .elements.filter((element) => element.kind === "a:tr")
    .map((element) => bytes.slice(element.start, element.end))
}

function rowOfMultiRowTable(bytes: Uint8Array): number | null {
  const elements = requireMarkup(bytes).elements
  const rows = elements.filter((element) => element.kind === "a:tr")
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (row === undefined) continue
    const table = tableOf(elements, row)
    if (table === null) continue
    if (rows.filter((other) => tableOf(elements, other) === table).length >= 2) return index + 1
  }
  return null
}

function tableOf(elements: readonly MarkupElement[], row: MarkupElement): MarkupElement | null {
  let parent = row.parent
  while (parent >= 0) {
    const next = elements[parent]
    if (next === undefined) return null
    if (next.kind === "a:tbl") return next
    parent = next.parent
  }
  return null
}

function tableHost(
  parts: ReadonlyMap<string, Uint8Array>,
  names: readonly string[],
): { part: string; removable: number | null; swap: { row: number; before: number } | null } | null {
  for (const name of names) {
    const bytes = parts.get(name)
    if (bytes === undefined) continue
    const rows = rowBytes(bytes)
    if (rows.length === 0) continue
    let swap: { row: number; before: number } | null = null
    for (let index = 0; index < rows.length - 1; index += 1) {
      const left = rows[index]
      const right = rows[index + 1]
      if (left !== undefined && right !== undefined && !sameBytes(left, right)) {
        swap = { row: index + 2, before: index + 1 }
        break
      }
    }
    return { part: name, removable: rowOfMultiRowTable(bytes), swap }
  }
  return null
}

function columnHost(
  parts: ReadonlyMap<string, Uint8Array>,
  names: readonly string[],
): { part: string; shape: string; columns: number } | null {
  for (const part of names) {
    const bytes = parts.get(part)
    if (bytes === undefined) continue
    const frames = requireMarkup(bytes).elements.filter((element) => element.kind === "p:cNvPr" && element.id !== null)
    for (const frame of frames) {
      const shape = frame.id ?? ""
      try {
        const grid = gridOf(bytes, shape)
        const widths = grid.widths.every((width) =>
          /^\d+$/.test(width.attributes.find((item) => item.name === "w")?.value ?? ""),
        )
        if (!grid.merged && grid.columns >= 2 && widths) return { part, shape, columns: grid.columns }
      } catch {
        continue
      }
    }
  }
  return null
}

export function tableEdits(parts: ReadonlyMap<string, Uint8Array>, names: readonly string[]): readonly TableEdit[] {
  const edits: TableEdit[] = []
  const table = tableHost(parts, names)
  if (table !== null) {
    edits.push({ name: "tbl.addRow", part: table.part, row: 1 })
    if (table.removable !== null) edits.push({ name: "tbl.removeRow", part: table.part, row: table.removable })
    if (table.swap !== null)
      edits.push({ name: "tbl.orderRow", part: table.part, row: table.swap.row, before: table.swap.before })
  }
  const grid = columnHost(parts, names)
  if (grid !== null) {
    edits.push({ name: "tbl.addColumn", part: grid.part, shape: grid.shape, column: 1, place: "after" })
    edits.push({ name: "tbl.removeColumn", part: grid.part, shape: grid.shape, column: grid.columns })
  }
  return edits
}

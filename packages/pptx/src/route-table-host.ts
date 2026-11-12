import type { MarkupElement } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"

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

export function tableHost(
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

import type { MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { cut, insertAt, moveBytes, requireMarkup, within } from "./part-markup.js"
import { nextShapeId } from "./shape-id.js"
import { tableFrame } from "./table-frame.js"

function rowAt(elements: readonly MarkupElement[], index: number): MarkupElement {
  if (!Number.isInteger(index) || index < 1) throw new Error("a:tr")
  const row = elements.filter((element) => element.kind === "a:tr")[index - 1]
  if (row === undefined) throw new Error("a:tr")
  return row
}

export function addTable(bytes: Uint8Array): Uint8Array {
  const document = requireMarkup(bytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  return insertAt(bytes, tree.closeStart, encodeUtf8(tableFrame(nextShapeId(decodeUtf8(bytes)))))
}

export function addRow(bytes: Uint8Array, row: number): Uint8Array {
  const found = rowAt(requireMarkup(bytes).elements, row)
  return insertAt(bytes, found.end, bytes.slice(found.start, found.end))
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

export function removeRow(bytes: Uint8Array, row: number): Uint8Array {
  const elements = requireMarkup(bytes).elements
  const found = rowAt(elements, row)
  const table = tableOf(elements, found)
  if (table === null) throw new Error("a:tr")
  const count = elements.filter((element) => element.kind === "a:tr" && within(elements, element, table)).length
  if (count < 2) throw new Error("a:tr")
  return cut(bytes, found.start, found.end)
}

export function orderRow(bytes: Uint8Array, row: number, before: number): Uint8Array {
  if (row === before) throw new Error("a:tr")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, rowAt(document.elements, row), rowAt(document.elements, before))
}

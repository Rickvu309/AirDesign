import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { insertAt, moveBytes, requireMarkup, within } from "./part-markup.js"
import { nextShapeId, shapeIdsIn } from "./shape-id.js"
import { tableFrame, type TableShape } from "./table-frame.js"

const emptyBytes = new Uint8Array(0)

function rowAt(elements: readonly MarkupElement[], index: number): MarkupElement {
  if (!Number.isInteger(index) || index < 1) throw new Error("a:tr")
  const row = elements.filter((element) => element.kind === "a:tr")[index - 1]
  if (row === undefined) throw new Error("a:tr")
  return row
}

function ancestor(elements: readonly MarkupElement[], child: MarkupElement, kind: string): MarkupElement | null {
  let parent = child.parent
  while (parent >= 0) {
    const next = elements[parent]
    if (next === undefined) return null
    if (next.kind === kind) return next
    parent = next.parent
  }
  return null
}

function heightOf(row: MarkupElement): number {
  const value = row.attributes.find((item) => item.name === "h")?.value ?? ""
  const height = /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(height)) throw new Error("a:tr")
  return height
}

export function frameGrowth(
  elements: readonly MarkupElement[],
  table: MarkupElement,
  side: "cx" | "cy",
  change: number,
): ByteEdit[] {
  const frame = ancestor(elements, table, "p:graphicFrame")
  if (frame === null) return []
  const ext = elements.find(
    (element) =>
      element.kind === "a:ext" && elements[element.parent]?.kind === "p:xfrm" && within(elements, element, frame),
  )
  const size = ext?.attributes.find((item) => item.name === side)
  if (size === undefined) return []
  const grown = /^\d+$/.test(size.value) ? Number(size.value) + change : NaN
  if (!Number.isSafeInteger(grown) || grown < 0) throw new Error("p:xfrm")
  return [{ start: size.valueStart, end: size.valueEnd, next: encodeUtf8(String(grown)) }]
}

function endingFrom(bytes: Uint8Array, format: MarkupElement): string {
  const opening = decodeUtf8(bytes.slice(format.start + "<a:rPr".length, format.openEnd))
  if (format.selfClosing) return `<a:endParaRPr${opening}`
  return `<a:endParaRPr${opening}${decodeUtf8(bytes.slice(format.openEnd, format.closeStart))}</a:endParaRPr>`
}

const idLimit = 4294967295

export function freshId(
  elements: readonly MarkupElement[],
  holder: MarkupElement,
  kind: "a16:rowId" | "a16:colId",
): ByteEdit[] {
  const value = (element: MarkupElement) => element.attributes.find((item) => item.name === "val")
  const own = elements.find((element) => element.kind === kind && within(elements, element, holder))
  const val = own === undefined ? undefined : value(own)
  if (val === undefined) return []
  const used = new Set(
    elements.flatMap((element) => {
      const each = element.kind === kind ? (value(element)?.value ?? "") : ""
      return /^\d+$/.test(each) ? [Number(each)] : []
    }),
  )
  const highest = Math.max(-1, ...used)
  let next = highest < idLimit ? highest + 1 : 0
  while (used.has(next)) next += 1
  return [{ start: val.valueStart - holder.start, end: val.valueEnd - holder.start, next: encodeUtf8(String(next)) }]
}

export function emptiedCells(
  bytes: Uint8Array,
  elements: readonly MarkupElement[],
  row: MarkupElement,
  extra: readonly ByteEdit[] = [],
): Uint8Array {
  const edits: ByteEdit[] = [...extra]
  const inside = elements.filter((element) => within(elements, element, row))
  for (const body of inside.filter((element) => element.kind === "a:txBody" && !element.selfClosing)) {
    const paragraphs = inside.filter((element) => element.kind === "a:p" && element.parent === body.index)
    const first = paragraphs[0]
    if (first === undefined) continue
    const owned = inside.filter((element) => element.parent === first.index)
    const properties = owned.find((element) => element.kind === "a:pPr")
    const ending = owned.find((element) => element.kind === "a:endParaRPr")
    const format = inside.find(
      (element) => element.kind === "a:rPr" && elements[element.parent]?.parent === first.index,
    )
    const kept = properties === undefined ? "" : decodeUtf8(bytes.slice(properties.start, properties.end))
    const end =
      ending !== undefined
        ? decodeUtf8(bytes.slice(ending.start, ending.end))
        : format !== undefined
          ? endingFrom(bytes, format)
          : '<a:endParaRPr lang="en-US"/>'
    const last = paragraphs.at(-1) ?? first
    edits.push({
      start: first.start - row.start,
      end: last.end - row.start,
      next: encodeUtf8(`<a:p>${kept}${end}</a:p>`),
    })
  }
  return spliceBytes(bytes.slice(row.start, row.end), edits)
}

function tableOf(elements: readonly MarkupElement[], row: MarkupElement): MarkupElement {
  const table = ancestor(elements, row, "a:tbl")
  if (table === null) throw new Error("a:tr")
  return table
}

export function addTable(bytes: Uint8Array, shape: TableShape & { readonly id?: number }, style: string) {
  const document = requireMarkup(bytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  const id = shape.id ?? nextShapeId(decodeUtf8(bytes))
  if (!Number.isInteger(id) || id < 2 || id > 4294967295 || shapeIdsIn(bytes).includes(String(id)))
    throw new Error("shape id")
  if (![shape.x, shape.y].every(Number.isSafeInteger)) throw new Error("emu")
  return insertAt(bytes, tree.closeStart, encodeUtf8(tableFrame(id, shape, style)))
}

export function addRow(bytes: Uint8Array, row: number): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const found = rowAt(elements, row)
  const grown = frameGrowth(elements, tableOf(elements, found), "cy", heightOf(found))
  return spliceBytes(bytes, [
    ...grown,
    {
      start: found.end,
      end: found.end,
      next: emptiedCells(bytes, elements, found, freshId(elements, found, "a16:rowId")),
    },
  ])
}

export function removeRow(bytes: Uint8Array, row: number): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const found = rowAt(elements, row)
  const table = tableOf(elements, found)
  const count = elements.filter((element) => element.kind === "a:tr" && within(elements, element, table)).length
  if (count < 2) throw new Error("a:tr")
  const shrunk = frameGrowth(elements, table, "cy", -heightOf(found))
  return spliceBytes(bytes, [...shrunk, { start: found.start, end: found.end, next: emptyBytes }])
}

export function orderRow(bytes: Uint8Array, row: number, before: number): Uint8Array {
  if (row === before) throw new Error("a:tr")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, rowAt(document.elements, row), rowAt(document.elements, before))
}

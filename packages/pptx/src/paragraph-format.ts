import type { ParagraphAlign, TextParagraph } from "@airdesign/document"
import { markupDocument, spliceBytes, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"

const alignValue: Readonly<Record<ParagraphAlign, string>> = { left: "l", center: "ctr", right: "r" }
const bulletKinds = new Set(["a:buNone", "a:buAutoNum", "a:buChar", "a:buBlip"])
const order = [
  "a:lnSpc",
  "a:spcBef",
  "a:spcAft",
  "a:buClrTx",
  "a:buClr",
  "a:buSzTx",
  "a:buSzPct",
  "a:buSzPts",
  "a:buFontTx",
  "a:buFont",
  "a:buNone",
  "a:buAutoNum",
  "a:buChar",
  "a:buBlip",
  "a:tabLst",
  "a:defRPr",
  "a:extLst",
]
const emptyBytes = new Uint8Array(0)

function joinBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const merged = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    merged.set(chunk, at)
    at += chunk.length
  }
  return merged
}

function rootOf(
  slice: Uint8Array,
): { readonly root: MarkupElement; readonly children: readonly MarkupElement[] } | null {
  const document = markupDocument(slice)
  const root = document.elements.find((element) => element.parent < 0)
  if (root === undefined) return null
  return { root, children: document.elements.filter((element) => element.parent === root.index) }
}

function created(paragraph: TextParagraph): Uint8Array {
  const align = paragraph.align === undefined ? "" : ` algn="${alignValue[paragraph.align]}"`
  if (paragraph.bullet === undefined) return encodeUtf8(`<a:pPr${align}/>`)
  const bullet = paragraph.bullet ? `<a:buChar char="•"/>` : `<a:buNone/>`
  return encodeUtf8(`<a:pPr${align}>${bullet}</a:pPr>`)
}

function alignBytes(slice: Uint8Array, align: ParagraphAlign): Uint8Array {
  const found = rootOf(slice)
  if (found === null) return slice
  const { root } = found
  const value = alignValue[align]
  const attribute = root.attributes.find((item) => item.name === "algn")
  if (attribute?.value === value) return slice
  if (attribute !== undefined) {
    return spliceBytes(slice, [{ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(value) }])
  }
  const nameEnd = root.start + 1 + root.kind.length
  const at = root.attributes.reduce((last, item) => Math.max(last, item.valueEnd + 1), nameEnd)
  return spliceBytes(slice, [{ start: at, end: at, next: encodeUtf8(` algn="${value}"`) }])
}

function slot(root: MarkupElement, children: readonly MarkupElement[]): number {
  const target = order.indexOf("a:buNone")
  let at = root.openEnd
  for (const child of children) {
    const rank = order.indexOf(child.kind)
    if (rank < 0) continue
    if (rank > target) return at
    at = child.end
  }
  return at
}

function bulletBytes(slice: Uint8Array, on: boolean): Uint8Array {
  const found = rootOf(slice)
  if (found === null) return slice
  const { root, children } = found
  const xml = encodeUtf8(on ? `<a:buChar char="•"/>` : `<a:buNone/>`)
  const choices = children.filter((child) => bulletKinds.has(child.kind))
  const first = choices[0]
  if (first !== undefined) {
    const edits = [{ start: first.start, end: first.end, next: xml }]
    for (const extra of choices.slice(1)) edits.push({ start: extra.start, end: extra.end, next: emptyBytes })
    return spliceBytes(slice, edits)
  }
  if (root.selfClosing) {
    const close = root.end - 2
    const next = joinBytes([encodeUtf8(">"), xml, encodeUtf8(`</${root.kind}>`)])
    return spliceBytes(slice, [{ start: close, end: root.end, next }])
  }
  const at = slot(root, children)
  return spliceBytes(slice, [{ start: at, end: at, next: xml }])
}

export function paragraphBytes(
  bytes: Uint8Array,
  properties: MarkupElement | undefined,
  paragraph: TextParagraph,
): Uint8Array | null {
  if (paragraph.align === undefined && paragraph.bullet === undefined) return null
  if (properties === undefined) return created(paragraph)
  let slice = bytes.subarray(properties.start, properties.end)
  if (paragraph.align !== undefined) slice = alignBytes(slice, paragraph.align)
  if (paragraph.bullet !== undefined) slice = bulletBytes(slice, paragraph.bullet)
  return slice
}

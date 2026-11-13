import type { RunColor } from "@airdesign/document"
import { childOrder } from "./child-order.js"
import { spliceBytes, markupDocument, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"

const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"])
const order: readonly string[] = childOrder["a:rPr"]
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

function fillText(color: RunColor): string {
  if ("scheme" in color) return `<a:solidFill><a:schemeClr val="${color.scheme}"/></a:solidFill>`
  return `<a:solidFill><a:srgbClr val="${color.rgb}"/></a:solidFill>`
}

function rootOf(
  slice: Uint8Array,
): { readonly root: MarkupElement; readonly children: readonly MarkupElement[] } | null {
  const document = markupDocument(slice)
  const root = document.elements.find((element) => element.parent < 0)
  if (root === undefined) return null
  return { root, children: document.elements.filter((element) => element.parent === root.index) }
}

function slot(root: MarkupElement, children: readonly MarkupElement[], tag: string): number {
  const target = order.indexOf(tag)
  let at = root.openEnd
  for (const child of children) {
    const rank = order.indexOf(child.kind)
    if (rank < 0) continue
    if (rank > target) return at
    at = child.end
  }
  return at
}

export function paintRunColor(slice: Uint8Array, color: RunColor): Uint8Array {
  const found = rootOf(slice)
  if (found === null) return slice
  const { root, children } = found
  const xml = encodeUtf8(fillText(color))
  const fills = children.filter((child) => fillKinds.has(child.kind))
  const first = fills[0]
  if (first !== undefined) {
    const edits: ByteEdit[] = [{ start: first.start, end: first.end, next: xml }]
    for (const extra of fills.slice(1)) edits.push({ start: extra.start, end: extra.end, next: emptyBytes })
    return spliceBytes(slice, edits)
  }
  if (root.selfClosing) {
    const close = root.end - 2
    const next = joinBytes([encodeUtf8(">"), xml, encodeUtf8(`</${root.kind}>`)])
    return spliceBytes(slice, [{ start: close, end: root.end, next }])
  }
  const at = slot(root, children, "a:solidFill")
  return spliceBytes(slice, [{ start: at, end: at, next: xml }])
}

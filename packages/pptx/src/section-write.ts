import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"

function idListXml(ids: readonly string[]): string {
  if (ids.length === 0) return "<p14:sldIdLst/>"
  return `<p14:sldIdLst>${ids.map((id) => `<p14:sldId id="${id}"/>`).join("")}</p14:sldIdLst>`
}

function listedIds(elements: readonly MarkupElement[], list: MarkupElement): string[] {
  return elements
    .filter((element) => element.kind === "p14:sldId" && element.id !== null && element.parent === list.index)
    .map((element) => element.id ?? "")
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, position) => id === right[position])
}

export function writeSectionSlides(bytes: Uint8Array, lists: readonly (readonly string[])[]): Uint8Array {
  const elements = requireMarkup(bytes).elements
  const sections = elements.filter((element) => element.kind === "p14:section").sort((a, b) => a.start - b.start)
  if (sections.length !== lists.length) throw new Error("section")
  const edits: ByteEdit[] = []
  for (const [number, section] of sections.entries()) {
    const wanted = lists[number] ?? []
    const list = elements.find((element) => element.kind === "p14:sldIdLst" && element.parent === section.index)
    if (list !== undefined && sameIds(listedIds(elements, list), wanted)) continue
    const next = encodeUtf8(idListXml(wanted))
    if (list !== undefined) {
      edits.push({ start: list.start, end: list.end, next })
      continue
    }
    if (section.selfClosing || section.closeStart < 0) throw new Error("section")
    edits.push({ start: section.closeStart, end: section.closeStart, next })
  }
  return spliceBytes(bytes, edits)
}

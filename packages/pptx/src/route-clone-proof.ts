import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { copyName } from "./layer-names.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"

function names(elements: readonly MarkupElement[]): readonly MarkupElement[] {
  return elements.filter((element) => element.kind === "p:cNvPr")
}

function attribute(mark: MarkupElement | undefined, name: string) {
  return mark?.attributes.find((item) => item.name === name)
}

function backToSource(piece: Uint8Array, source: Uint8Array): Uint8Array | string {
  const marks = names(requireMarkup(piece).elements)
  const sourceMarks = names(requireMarkup(source).elements)
  if (marks.length !== sourceMarks.length) return "the copy holds another number of layers"
  const edits: ByteEdit[] = []
  for (const [index, mark] of marks.entries()) {
    const id = attribute(mark, "id")
    const was = sourceMarks[index]?.id
    if (id === undefined || was === null || was === undefined) return "a layer of the copy has no id"
    edits.push({ start: id.valueStart, end: id.valueEnd, next: encodeUtf8(was) })
    const name = attribute(mark, "name")
    const sourceName = attribute(sourceMarks[index], "name")
    if (name === undefined || sourceName === undefined || name.value === sourceName.value) continue
    if (name.value !== copyName(sourceName.value, mark.id ?? "")) return `the copy is named ${name.value}`
    edits.push({ start: name.valueStart, end: name.valueEnd, next: encodeUtf8(sourceName.value) })
  }
  return spliceBytes(piece, edits)
}

export function cloneFault(old: Uint8Array, next: Uint8Array, shape: string): string | null {
  const elements = requireMarkup(old).elements
  const found = shapeById(elements, shape)
  const end = found.end + next.length - old.length
  if (!sameBytes(spliceBytes(next, [{ start: found.end, end, next: new Uint8Array() }]), old))
    return "bytes outside the copy changed"
  const restored = backToSource(next.slice(found.end, end), old.slice(found.start, found.end))
  if (typeof restored === "string") return restored
  if (!sameBytes(restored, old.slice(found.start, found.end))) return "the copy differs from its source"
  const used = new Set(names(elements).map((mark) => mark.id))
  const fresh = names(requireMarkup(next.slice(found.end, end)).elements).map((mark) => mark.id)
  if (new Set(fresh).size !== fresh.length || fresh.some((id) => used.has(id))) return "the copy reuses an id"
  return null
}

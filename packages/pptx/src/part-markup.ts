import { markupDocument, spliceBytes, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { sameBytes } from "./package-bytes.js"

const emptyBytes = new Uint8Array(0)

export function partBytes(parts: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error("part")
  return bytes
}

export function replacePart(parts: Map<string, Uint8Array>, name: string, next: Uint8Array) {
  const before = parts.get(name)
  if (before !== undefined && sameBytes(before, next)) return
  parts.set(name, next)
}

export function requireMarkup(bytes: Uint8Array): MarkupDocument {
  const document = markupDocument(bytes)
  if (!document.wellFormed) throw new Error("xml")
  return document
}

export function attribute(element: MarkupElement, name: string, error: string): string {
  const found = element.attributes.find((item) => item.name === name)
  if (found === undefined || found.value === "") throw new Error(error)
  return found.value
}

export function digits(value: string): number | null {
  if (value.length === 0) return null
  let number = 0
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 48 || code > 57) return null
    number = number * 10 + (code - 48)
    if (!Number.isSafeInteger(number)) return null
  }
  return number
}

export function elementById(
  elements: readonly MarkupElement[],
  kind: string,
  id: string,
  error: string,
): MarkupElement {
  const found = elements.find((element) => element.kind === kind && element.id === id)
  if (found === undefined) throw new Error(error)
  return found
}

export function insertAt(bytes: Uint8Array, at: number, next: Uint8Array): Uint8Array {
  return spliceBytes(bytes, [{ start: at, end: at, next }])
}

export function cut(bytes: Uint8Array, start: number, end: number): Uint8Array {
  return spliceBytes(bytes, [{ start, end, next: emptyBytes }])
}

export function moveBytes(bytes: Uint8Array, moving: MarkupElement, target: MarkupElement): Uint8Array {
  if (moving.start === target.start) throw new Error("span")
  if (moving.start < target.end && target.start < moving.end) throw new Error("span")
  const piece = bytes.slice(moving.start, moving.end)
  const without = cut(bytes, moving.start, moving.end)
  const shift = moving.start < target.start ? moving.end - moving.start : 0
  return insertAt(without, target.start - shift, piece)
}

export function rootClose(document: MarkupDocument, kind: string, error: string): number {
  const found = document.elements.find((element) => element.kind === kind && element.parent < 0)
  if (found === undefined || found.selfClosing || found.closeStart < 0) throw new Error(error)
  return found.closeStart
}

export function editPart(parts: Map<string, Uint8Array>, name: string, edit: (bytes: Uint8Array) => Uint8Array) {
  const before = partBytes(parts, name)
  replacePart(parts, name, edit(before))
}

import { readMarkup, type MarkupDocument, type MarkupElement } from "./markup-reader.js"

const cdataOpen = "<![CDATA["
const cdataClose = "]]>"
const namedReferences = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
])

export type { MarkupAttribute, MarkupDocument, MarkupElement } from "./markup-reader.js"

export type ByteEdit = {
  readonly start: number
  readonly end: number
  readonly next: Uint8Array
}

export type ContentSpan = {
  readonly start: number
  readonly end: number
  readonly literal: boolean
}

function commentOrInstructionEnd(bytes: Uint8Array, at: number, limit: number): number | null {
  if (markerAt(bytes, at, "<!--")) return afterMarker(bytes, at + 4, limit, "-->")
  if (markerAt(bytes, at, "<?")) return afterMarker(bytes, at + 2, limit, "?>")
  return null
}

function markerAt(bytes: Uint8Array, at: number, marker: string): boolean {
  for (let index = 0; index < marker.length; index += 1) {
    if (bytes[at + index] !== marker.charCodeAt(index)) return false
  }
  return true
}

function afterMarker(bytes: Uint8Array, from: number, limit: number, marker: string): number {
  for (let at = from; at + marker.length <= limit; at += 1) {
    if (markerAt(bytes, at, marker)) return at + marker.length
  }
  return limit
}

function numericReference(token: string): string | null {
  const hex = token[1] === "x"
  const digits = token.slice(hex ? 2 : 1)
  if (!(hex ? /^[0-9a-fA-F]+$/ : /^[0-9]+$/).test(digits)) return null
  const code = Number.parseInt(digits, hex ? 16 : 10)
  if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null
  return String.fromCodePoint(code)
}

function referenceText(token: string): string | null {
  return token.startsWith("#") ? numericReference(token) : (namedReferences.get(token) ?? null)
}

export function decodedXmlText(value: string): string {
  let text = ""
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "&") continue
    let end = index + 1
    while (end < value.length && value[end] !== ";") end += 1
    if (end >= value.length) return text + value.slice(start)
    const decoded = referenceText(value.slice(index + 1, end))
    text += value.slice(start, index) + (decoded ?? value.slice(index, end + 1))
    start = end + 1
    index = end
  }
  return text + value.slice(start)
}

export function contentSpans(bytes: Uint8Array, element: MarkupElement): readonly ContentSpan[] {
  if (element.selfClosing) return []
  const spans: ContentSpan[] = []
  const limit = element.closeStart
  let textStart = element.openEnd
  let at = textStart
  const closeText = () => {
    if (at > textStart) spans.push({ start: textStart, end: at, literal: false })
  }
  while (at < limit) {
    const skipped = commentOrInstructionEnd(bytes, at, limit)
    if (skipped !== null) {
      closeText()
      at = skipped
      textStart = at
    } else if (markerAt(bytes, at, cdataOpen)) {
      closeText()
      const end = afterMarker(bytes, at + cdataOpen.length, limit, cdataClose)
      spans.push({ start: at + cdataOpen.length, end: end - cdataClose.length, literal: true })
      at = end
      textStart = at
    } else {
      at += 1
    }
  }
  closeText()
  return spans
}

const readDocuments = new WeakMap<Uint8Array, MarkupDocument>()
let lastDocumentBytes: Uint8Array | undefined
let lastDocument: MarkupDocument | undefined
let prevDocumentBytes: Uint8Array | undefined
let prevDocument: MarkupDocument | undefined
let transientDepth = 0

export function isTransientMarkup(): boolean {
  return transientDepth > 0
}

export function withTransientMarkup<T>(run: () => T): T {
  transientDepth += 1
  try {
    return run()
  } finally {
    transientDepth -= 1
    if (transientDepth === 0) {
      lastDocumentBytes = undefined
      lastDocument = undefined
      prevDocumentBytes = undefined
      prevDocument = undefined
    }
  }
}

export function withPersistentMarkup<T>(run: () => T): T {
  const saved = transientDepth
  transientDepth = 0
  try {
    return run()
  } finally {
    transientDepth = saved
  }
}

export function markupDocument(bytes: Uint8Array): MarkupDocument {
  if (lastDocumentBytes === bytes) return lastDocument!
  if (prevDocumentBytes === bytes) return prevDocument!
  const known = readDocuments.get(bytes)
  if (known !== undefined) return known
  const document = readMarkup(bytes, true)
  if (document.wellFormed) {
    if (transientDepth === 0) readDocuments.set(bytes, document)
    prevDocumentBytes = lastDocumentBytes
    prevDocument = lastDocument
    lastDocumentBytes = bytes
    lastDocument = document
  }
  return document
}

export function markupLimits(bytes: Uint8Array, keep = false): MarkupDocument {
  return keep ? markupDocument(bytes) : readMarkup(bytes, false)
}

export function spliceBytes(bytes: Uint8Array, edits: readonly ByteEdit[]): Uint8Array {
  if (edits.length === 0) return bytes
  if (edits.length === 1) {
    const edit = edits[0]!
    if (edit.start < 0 || edit.end < edit.start || edit.end > bytes.length) throw new Error("span")
    const merged = new Uint8Array(bytes.length - (edit.end - edit.start) + edit.next.length)
    if (edit.start > 0) merged.set(bytes.subarray(0, edit.start), 0)
    if (edit.next.length > 0) merged.set(edit.next, edit.start)
    if (edit.end < bytes.length) merged.set(bytes.subarray(edit.end), edit.start + edit.next.length)
    return merged
  }
  const ordered = edits.slice().sort((left, right) => right.start - left.start)
  const pieces: Uint8Array[] = []
  let cursor = bytes.length
  let total = 0
  for (const edit of ordered) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > cursor) throw new Error("span")
    if (cursor > edit.end) {
      const tail = bytes.subarray(edit.end, cursor)
      pieces.push(tail)
      total += tail.length
    }
    if (edit.next.length > 0) {
      pieces.push(edit.next)
      total += edit.next.length
    }
    cursor = edit.start
  }
  if (cursor > 0) {
    const head = bytes.subarray(0, cursor)
    pieces.push(head)
    total += head.length
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index]!
    merged.set(piece, offset)
    offset += piece.length
  }
  return merged
}

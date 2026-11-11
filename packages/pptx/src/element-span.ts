import { SAXParser, SaxEventType, type Tag, type Text } from "sax-wasm"

const events = SaxEventType.OpenTag | SaxEventType.CloseTag | SaxEventType.Text | SaxEventType.Doctype
const pageBytes = 65536
const chunkBytes = 64 * 1024
const cdataOpen = "<![CDATA["
const cdataClose = "]]>"
const namedReferences = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
])

export type MarkupAttribute = {
  readonly name: string
  readonly value: string
  readonly valueStart: number
  readonly valueEnd: number
}

export type MarkupElement = {
  readonly index: number
  readonly kind: string
  readonly id: string | null
  readonly start: number
  readonly end: number
  readonly openEnd: number
  readonly closeStart: number
  readonly selfClosing: boolean
  readonly depth: number
  readonly parent: number
  readonly attributes: readonly MarkupAttribute[]
}

export type MarkupDocument = {
  readonly elements: readonly MarkupElement[]
  readonly depth: number
  readonly attributes: number
  readonly nodes: number
  readonly wellFormed: boolean
}

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

type MarkupSlot = {
  parser: SAXParser | null
  wasm: Uint8Array | null
  starting: Promise<void> | null
}

type WasmMemory = {
  readonly buffer: ArrayBuffer
  grow: (pages: number) => number
}

type FetchResponse = {
  readonly ok: boolean
  readonly arrayBuffer: () => Promise<ArrayBuffer>
}

type OpenElement = {
  index: number
  kind: string
  id: string | null
  start: number
  end: number
  openEnd: number
  closeStart: number
  selfClosing: boolean
  depth: number
  parent: number
  attributes: MarkupAttribute[]
}

const globalMarkup = globalThis as { __airdesignMarkup?: MarkupSlot }

function slot(): MarkupSlot {
  const existing = globalMarkup.__airdesignMarkup
  if (existing !== undefined) return existing
  const created = { parser: null, wasm: null, starting: null }
  globalMarkup.__airdesignMarkup = created
  return created
}

function webAssembly(): {
  Module: new (bytes: ArrayBuffer) => object
  Instance: new (
    module: object,
    imports: { env: { memory: WasmMemory; table: object; event_listener_v1: SAXParser["eventTrap"] } },
  ) => { exports: NonNullable<SAXParser["wasmSaxParser"]> }
  Memory: new (descriptor: { initial: number; maximum: number }) => WasmMemory
  Table: new (descriptor: { initial: number; element: "anyfunc" }) => object
} {
  const value = (globalThis as { WebAssembly?: ReturnType<typeof webAssembly> }).WebAssembly
  if (value === undefined) throw new Error("wasm")
  return value
}

function instantiate(wasm: Uint8Array): SAXParser {
  const copy = new Uint8Array(wasm.byteLength)
  copy.set(wasm)
  const parser = new SAXParser(events)
  const assembly = webAssembly()
  const memory = new assembly.Memory({ initial: 10, maximum: 512 })
  const table = new assembly.Table({ initial: 1, element: "anyfunc" })
  const instance = new assembly.Instance(new assembly.Module(copy.buffer as ArrayBuffer), {
    env: { memory, table, event_listener_v1: parser.eventTrap },
  })
  const exported = instance.exports
  if (exported.event_abi_version() !== 1) throw new Error("wasm")
  parser.wasmSaxParser = exported
  exported.parser(parser.events ?? events)
  return parser
}

export function prepareMarkup(wasm: Uint8Array): Promise<void> {
  const current = slot()
  current.wasm = wasm
  current.starting = null
  current.parser = instantiate(wasm)
  return Promise.resolve()
}

async function fetchWasm(): Promise<Uint8Array> {
  const fetchImpl = (globalThis as { fetch?: (input: string) => Promise<FetchResponse> }).fetch
  if (fetchImpl === undefined) throw new Error("wasm")
  const meta = import.meta as { resolve?: (specifier: string) => string }
  if (meta.resolve === undefined) throw new Error("wasm")
  const response = await fetchImpl(meta.resolve("sax-wasm/lib/sax-wasm.wasm"))
  if (!response.ok) throw new Error("wasm")
  return new Uint8Array(await response.arrayBuffer())
}

function activeParser(): SAXParser {
  const current = slot()
  if (current.parser !== null) return current.parser
  if (current.wasm === null) throw new Error("wasm")
  current.parser = instantiate(current.wasm)
  return current.parser
}

export async function markupReady(): Promise<void> {
  const current = slot()
  if (current.parser !== null) return
  if (current.starting !== null) {
    await current.starting
    return
  }
  if (current.wasm !== null) {
    current.parser = instantiate(current.wasm)
    return
  }
  await prepareMarkup(await fetchWasm())
}

function fit(memory: WasmMemory, bytes: number): void {
  const have = memory.buffer.byteLength
  if (have >= bytes) return
  memory.grow(Math.ceil((bytes - have) / pageBytes))
}

function commentOrInstructionEnd(bytes: Uint8Array, at: number, limit: number): number | null {
  if (markerAt(bytes, at, "<!--")) return afterMarker(bytes, at + 4, limit, "-->")
  if (markerAt(bytes, at, "<?")) return afterMarker(bytes, at + 2, limit, "?>")
  return null
}

function closeStart(bytes: Uint8Array, end: number, kind: string): number {
  const marker = `</${kind}>`
  const start = end - marker.length
  if (start < 0) return -1
  for (let index = 0; index < marker.length; index += 1) {
    if (bytes[start + index] !== marker.charCodeAt(index)) return -1
  }
  return start
}

function kindFollows(bytes: Uint8Array, index: number, kind: string): boolean {
  if (index + kind.length >= bytes.length) return false
  for (let cursor = 0; cursor < kind.length; cursor += 1) {
    const code = kind.charCodeAt(cursor)
    if (code > 127 || bytes[index + cursor] !== code) return false
  }
  const next = bytes[index + kind.length]
  return next === 32 || next === 9 || next === 10 || next === 13 || next === 47 || next === 62
}

function tagStart(bytes: Uint8Array, end: number, kind: string): number {
  if (end < 2 || end > bytes.length || bytes[end - 1] !== 62) return -1
  let quote = 0
  for (let index = end - 2; index >= 0; index -= 1) {
    const byte = bytes[index]
    if (quote !== 0) {
      if (byte === quote) quote = 0
      continue
    }
    if (byte === 34 || byte === 39) {
      quote = byte
      continue
    }
    if (byte !== 60) continue
    return kindFollows(bytes, index + 1, kind) ? index : -1
  }
  return -1
}

function writeDocument(parser: SAXParser, bytes: Uint8Array): void {
  const wasm = parser.wasmSaxParser
  if (wasm === undefined) throw new Error("wasm")
  fit(wasm.memory, chunkBytes + 4)
  wasm.parser(parser.events ?? events)
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    parser.write(bytes.subarray(offset, Math.min(offset + chunkBytes, bytes.length)))
  }
  parser.end()
}

function readMarkup(bytes: Uint8Array, full: boolean): MarkupDocument {
  const parser = activeParser()
  const elements: OpenElement[] = []
  const stack: OpenElement[] = []
  const names: string[] = []
  let depth = 0
  let attributes = 0
  let nodes = 0
  let wellFormed = true
  parser.eventHandler = (type, detail) => {
    if (type === SaxEventType.Doctype) {
      wellFormed = false
      return
    }
    if (type === SaxEventType.Text) {
      const text = detail as Text
      const start = text.byteOffsets.start
      const end = text.byteOffsets.end
      if (text.value.length > 0 && start === end) wellFormed = false
      return
    }
    if (type !== SaxEventType.OpenTag && type !== SaxEventType.CloseTag) return
    const tag = detail as Tag
    if (!full) {
      if (type === SaxEventType.CloseTag) {
        if (!tag.selfClosing && names.pop() !== tag.name) wellFormed = false
        return
      }
      nodes += 1
      const attributeCount = tag.attributes.length
      if (attributeCount > attributes) attributes = attributeCount
      const level = names.length + 1
      if (level > depth) depth = level
      if (!tag.selfClosing) names.push(tag.name)
      return
    }
    const name = tag.name
    const selfClosing = tag.selfClosing
    const end = tag.byteOffsets.end
    const repaired = tagStart(bytes, end, name)
    const start = repaired >= 0 ? repaired : tag.byteOffsets.start
    if (type === SaxEventType.CloseTag) {
      if (selfClosing) return
      const open = stack.pop()
      if (open === undefined || open.kind !== name) {
        wellFormed = false
        return
      }
      open.end = end
      const close = closeStart(bytes, end, name)
      if (close < 0) wellFormed = false
      else open.closeStart = close
      return
    }
    nodes += 1
    const attributeCount = tag.attributes.length
    if (attributeCount > attributes) attributes = attributeCount
    const level = stack.length + 1
    if (level > depth) depth = level
    const copied: MarkupAttribute[] = []
    let id: string | null = null
    for (const attribute of tag.attributes) {
      const attributeName = attribute.name.value
      const value = attribute.value.value
      copied.push({
        name: attributeName,
        value,
        valueStart: attribute.value.byteOffsets.start,
        valueEnd: attribute.value.byteOffsets.end,
      })
      if (id === null && attributeName === "id") id = value
    }
    const parentElement = stack[stack.length - 1]
    const element: OpenElement = {
      index: elements.length,
      kind: name,
      id,
      start,
      end,
      openEnd: end,
      closeStart: selfClosing ? start : end,
      selfClosing,
      depth: level,
      parent: parentElement === undefined ? -1 : parentElement.index,
      attributes: copied,
    }
    if (!selfClosing) stack.push(element)
    elements.push(element)
  }
  try {
    writeDocument(parser, bytes)
  } catch {
    wellFormed = false
    slot().parser = null
    try {
      parser.end()
    } catch {
      wellFormed = false
    }
  } finally {
    parser.eventHandler = () => {}
  }
  if ((full ? stack.length : names.length) !== 0) wellFormed = false
  return { elements, depth, attributes, nodes, wellFormed }
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

export function markupDocument(bytes: Uint8Array): MarkupDocument {
  return readMarkup(bytes, true)
}

export function markupLimits(bytes: Uint8Array): MarkupDocument {
  return readMarkup(bytes, false)
}

export function spliceBytes(bytes: Uint8Array, edits: readonly ByteEdit[]): Uint8Array {
  if (edits.length === 0) return bytes
  const ordered = edits.slice().sort((left, right) => right.start - left.start)
  let next = bytes
  let cursor = next.length
  for (const edit of ordered) {
    if (edit.start < 0 || edit.end < edit.start || edit.end > cursor) throw new Error("span")
    const merged = new Uint8Array(edit.start + edit.next.length + next.length - edit.end)
    merged.set(next.subarray(0, edit.start), 0)
    merged.set(edit.next, edit.start)
    merged.set(next.subarray(edit.end), edit.start + edit.next.length)
    next = merged
    cursor = edit.start
  }
  return next
}

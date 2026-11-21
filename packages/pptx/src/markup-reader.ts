import { decodeLatin1, decodeUtf8 } from "./package-bytes.js"

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

type Tag = {
  nameEnd: number
  end: number
  selfClosing: boolean
  attributes: number
  id: string | null
}

const lessThan = 60
const greaterThan = 62
const slash = 47
const bang = 33
const question = 63
const equals = 61
const doubleQuote = 34
const singleQuote = 39
const space = 32
const tab = 9
const lineFeed = 10
const carriageReturn = 13
const commentOpen = "<!--"
const commentClose = "-->"
const cdataOpen = "<![CDATA["
const cdataClose = "]]>"
const knownNames = new Map<number, string>()
const knownNamesLimit = 4096
let bytesRead = 0

function isUtf8(bytes: Uint8Array): boolean {
  const length = bytes.length
  let at = 0
  while (at < length) {
    const first = bytes[at]!
    if (first < 0x80) {
      at += 1
      continue
    }
    let width = 4
    let low = 0x80
    let high = 0xbf
    if (first >= 0xc2 && first <= 0xdf) width = 2
    else if (first >= 0xe0 && first <= 0xef) {
      width = 3
      if (first === 0xe0) low = 0xa0
      if (first === 0xed) high = 0x9f
    } else if (first >= 0xf0 && first <= 0xf4) {
      if (first === 0xf0) low = 0x90
      if (first === 0xf4) high = 0x8f
    } else return false
    if (at + width > length) return false
    const second = bytes[at + 1]!
    if (second < low || second > high) return false
    for (let extra = 2; extra < width; extra += 1) {
      const next = bytes[at + extra]!
      if (next < 0x80 || next > 0xbf) return false
    }
    at += width
  }
  return true
}

function characterWidth(first: number): number {
  if (first < 0x80) return 1
  if (first < 0xe0) return 2
  if (first < 0xf0) return 3
  return 4
}

function codePointAt(bytes: Uint8Array, at: number): number {
  const first = bytes[at] ?? 0
  const width = characterWidth(first)
  if (width === 1) return first
  let code = first & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07)
  for (let extra = 1; extra < width; extra += 1) code = (code << 6) | ((bytes[at + extra] ?? 0) & 0x3f)
  return code
}

function nameStartAt(bytes: Uint8Array, at: number): boolean {
  const code = codePointAt(bytes, at)
  if (code < 0x80)
    return (code >= 0x61 && code <= 0x7a) || (code >= 0x41 && code <= 0x5a) || code === 0x3a || code === 0x5f
  return (
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0x2ff) ||
    (code >= 0x370 && code <= 0x37d) ||
    (code >= 0x37f && code <= 0x1fff) ||
    (code >= 0x200c && code <= 0x200d) ||
    (code >= 0x2070 && code <= 0x218f) ||
    (code >= 0x2c00 && code <= 0x2fef) ||
    (code >= 0x3001 && code <= 0xd7ff) ||
    (code >= 0xf900 && code <= 0xfdcf) ||
    (code >= 0xfdf0 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0xeffff)
  )
}

function foreignInName(byte: number): boolean {
  return byte === lessThan || byte === doubleQuote || byte === singleQuote
}

function tagNameEnd(bytes: Uint8Array, from: number): number {
  const length = bytes.length
  for (let at = from; at < length; at += 1) {
    const byte = bytes[at]!
    if (
      byte === greaterThan ||
      byte === slash ||
      byte === space ||
      byte === lineFeed ||
      byte === tab ||
      byte === carriageReturn
    ) {
      return at
    }
    if (foreignInName(byte)) return -1
  }
  return -1
}

function attributeNameEnd(bytes: Uint8Array, from: number): number {
  const length = bytes.length
  for (let at = from; at < length; at += 1) {
    const byte = bytes[at]!
    if (byte === equals || byte === greaterThan || byte === space || byte === tab || byte === lineFeed) return at
    if (foreignInName(byte)) return -1
  }
  return -1
}

function blankAfter(bytes: Uint8Array, from: number): number {
  const length = bytes.length
  let at = from
  while (at < length && bytes[at]! < 33) at += 1
  return at
}

function spaceAfter(bytes: Uint8Array, from: number): number {
  const length = bytes.length
  let at = from
  while (at < length) {
    const byte = bytes[at]!
    if (byte !== space && byte !== tab && byte !== lineFeed && byte !== carriageReturn) break
    at += 1
  }
  return at
}

function text(bytes: Uint8Array, start: number, end: number): string {
  const span = end - start
  if (span === 0) return ""
  if (span > 64) {
    for (let at = start; at < end; at += 1) {
      if (bytes[at]! >= 0x80) return decodeUtf8(bytes.subarray(start, end))
    }
    return decodeLatin1(bytes.subarray(start, end))
  }
  let value = ""
  for (let at = start; at < end; at += 1) {
    const byte = bytes[at]!
    if (byte >= 0x80) return decodeUtf8(bytes.subarray(start, end))
    value += String.fromCharCode(byte)
  }
  return value
}

function sameText(bytes: Uint8Array, start: number, end: number, known: string): boolean {
  if (known.length !== end - start) return false
  for (let offset = 0; offset < known.length; offset += 1) {
    if (bytes[start + offset] !== known.charCodeAt(offset)) return false
  }
  return true
}

function name(bytes: Uint8Array, start: number, end: number): string {
  let key = end - start
  for (let at = start; at < end; at += 1) {
    const byte = bytes[at]!
    if (byte >= 0x80) return decodeUtf8(bytes.subarray(start, end))
    key = (Math.imul(key, 31) + byte) | 0
  }
  const known = knownNames.get(key)
  if (known !== undefined && sameText(bytes, start, end, known)) return known
  const made = text(bytes, start, end)
  if (knownNames.size < knownNamesLimit) knownNames.set(key, made)
  return made
}

function sameName(bytes: Uint8Array, start: number, end: number, otherStart: number, otherEnd: number): boolean {
  if (end - start !== otherEnd - otherStart) return false
  for (let offset = 0; offset < end - start; offset += 1) {
    if (bytes[start + offset] !== bytes[otherStart + offset]) return false
  }
  return true
}

function markerAt(bytes: Uint8Array, at: number, marker: string): boolean {
  for (let index = 0; index < marker.length; index += 1) {
    if (bytes[at + index] !== marker.charCodeAt(index)) return false
  }
  return true
}

function afterMarker(bytes: Uint8Array, from: number, marker: string): number {
  const last = marker.charCodeAt(marker.length - 1)
  for (let end = bytes.indexOf(last, from + marker.length - 1); end >= 0; end = bytes.indexOf(last, end + 1)) {
    if (markerAt(bytes, end - marker.length + 1, marker)) return end + 1
  }
  return -1
}

function declarationEnd(bytes: Uint8Array, at: number): number {
  if (markerAt(bytes, at, commentOpen)) return afterMarker(bytes, at + commentOpen.length, commentClose)
  if (markerAt(bytes, at, cdataOpen)) return afterMarker(bytes, at + cdataOpen.length, cdataClose)
  return -1
}

function instructionEnd(bytes: Uint8Array, at: number): number {
  const close = bytes.indexOf(greaterThan, at + 2)
  return close < 0 ? -1 : close + 1
}

function closeTagEnd(bytes: Uint8Array, at: number, nameStart: number, nameEnd: number): number {
  const first = bytes[at + 2]
  if (first === greaterThan || first === space) return -1
  let cursor = at + 2
  while (cursor < bytes.length && bytes[cursor] !== greaterThan && bytes[cursor] !== space) cursor += 1
  if (!sameName(bytes, at + 2, cursor, nameStart, nameEnd)) return -1
  const close = spaceAfter(bytes, cursor)
  return bytes[close] === greaterThan ? close + 1 : -1
}

function closeStart(bytes: Uint8Array, end: number, kind: string): number {
  const start = end - kind.length - 3
  if (start < 0 || bytes[start] !== lessThan || bytes[start + 1] !== slash || bytes[end - 1] !== greaterThan) return -1
  for (let index = 0; index < kind.length; index += 1) {
    if (bytes[start + 2 + index] !== kind.charCodeAt(index)) return -1
  }
  return start
}

function readOpenTag(bytes: Uint8Array, start: number, tag: Tag, found: MarkupAttribute[] | null): boolean {
  const kindEnd = tagNameEnd(bytes, start + 1)
  if (kindEnd < 0) return false
  tag.nameEnd = kindEnd
  tag.attributes = 0
  tag.id = null
  let at = kindEnd
  while (at < bytes.length) {
    const byte = bytes[at] ?? 0
    if (byte < 33) {
      at += 1
      continue
    }
    if (byte === greaterThan || byte === slash) {
      tag.selfClosing = byte === slash
      tag.end = at + (tag.selfClosing ? 2 : 1)
      return !tag.selfClosing || bytes[at + 1] === greaterThan
    }
    const attributeEnd = attributeNameEnd(bytes, at)
    if (attributeEnd < 0) return false
    const equalsAt = blankAfter(bytes, attributeEnd)
    if (bytes[equalsAt] !== equals) return false
    const quoteAt = blankAfter(bytes, equalsAt + 1)
    const quote = bytes[quoteAt] ?? 0
    if (quote !== doubleQuote && quote !== singleQuote) return false
    const valueStart = quoteAt + 1
    const valueEnd = bytes.indexOf(quote, valueStart)
    if (valueEnd < 0) return false
    tag.attributes += 1
    if (found !== null) {
      const attribute = {
        name: name(bytes, at, attributeEnd),
        value: text(bytes, valueStart, valueEnd),
        valueStart,
        valueEnd,
      }
      if (tag.id === null && attribute.name === "id") tag.id = attribute.value
      found.push(attribute)
    }
    at = valueEnd + 1
  }
  return false
}

export function markupBytesRead(): number {
  return bytesRead
}

export function readMarkup(bytes: Uint8Array, full: boolean): MarkupDocument {
  bytesRead += bytes.length
  const elements: OpenElement[] = []
  const stack: OpenElement[] = []
  const nameStarts: number[] = []
  const nameEnds: number[] = []
  const tag: Tag = { nameEnd: 0, end: 0, selfClosing: false, attributes: 0, id: null }
  let depth = 0
  let attributes = 0
  let nodes = 0
  let wellFormed = true
  const refused = (): MarkupDocument => ({ elements, depth, attributes, nodes, wellFormed: false })
  if (!isUtf8(bytes)) return refused()
  let at = bytes.indexOf(lessThan)
  while (at >= 0) {
    const next = bytes[at + 1] ?? -1
    let after = -1
    if (next === bang) after = declarationEnd(bytes, at)
    else if (next === question) after = instructionEnd(bytes, at)
    else if (next === slash) {
      const top = nameStarts.length - 1
      if (top < 0) return refused()
      after = closeTagEnd(bytes, at, nameStarts[top] ?? 0, nameEnds[top] ?? 0)
      if (after < 0) return refused()
      nameStarts.pop()
      nameEnds.pop()
      const open = stack.pop()
      if (open !== undefined) {
        open.end = after
        if (after - at === open.kind.length + 3 && bytes[after - 1] === greaterThan) open.closeStart = at
        else {
          const found = closeStart(bytes, after, open.kind)
          if (found < 0) wellFormed = false
          else open.closeStart = found
        }
      }
    } else if (next < 0 || next === greaterThan) return refused()
    else if (!nameStartAt(bytes, at + 1)) after = at + 2
    else {
      const copied: MarkupAttribute[] | null = full ? [] : null
      if (!readOpenTag(bytes, at, tag, copied)) return refused()
      nodes += 1
      if (tag.attributes > attributes) attributes = tag.attributes
      const level = nameStarts.length + 1
      if (level > depth) depth = level
      if (!tag.selfClosing) {
        nameStarts.push(at + 1)
        nameEnds.push(tag.nameEnd)
      }
      if (copied !== null) {
        const parent = stack[stack.length - 1]
        const element: OpenElement = {
          index: elements.length,
          kind: name(bytes, at + 1, tag.nameEnd),
          id: tag.id,
          start: at,
          end: tag.end,
          openEnd: tag.end,
          closeStart: tag.selfClosing ? at : tag.end,
          selfClosing: tag.selfClosing,
          depth: level,
          parent: parent === undefined ? -1 : parent.index,
          attributes: copied,
        }
        if (!tag.selfClosing) stack.push(element)
        elements.push(element)
      }
      after = tag.end
    }
    if (after < 0) return refused()
    at = bytes.indexOf(lessThan, after)
  }
  if (nameStarts.length !== 0) wellFormed = false
  return { elements, depth, attributes, nodes, wellFormed }
}

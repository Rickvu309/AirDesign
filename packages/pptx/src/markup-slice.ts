import { markupDocument } from "./element-span.js"
import { partOf } from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"

function findBytes(bytes: Uint8Array, needle: Uint8Array, from: number): number {
  const last = bytes.length - needle.length
  for (let at = from; at <= last; at += 1) {
    let same = true
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[at + index] !== needle[index]) {
        same = false
        break
      }
    }
    if (same) return at
  }
  return -1
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const part of parts) length += part.length
  const bytes = new Uint8Array(length)
  let at = 0
  for (const part of parts) {
    bytes.set(part, at)
    at += part.length
  }
  return bytes
}

function tagEnd(bytes: Uint8Array, from: number): number {
  let quote = 0
  for (let at = from; at < bytes.length; at += 1) {
    const byte = bytes[at] ?? 0
    if (quote !== 0) {
      if (byte === quote) quote = 0
      continue
    }
    if (byte === 34 || byte === 39) quote = byte
    else if (byte === 62) return at + 1
  }
  return -1
}

function nameEnd(bytes: Uint8Array, start: number): number {
  let at = start + 1
  while (at < bytes.length) {
    const byte = bytes[at] ?? 0
    if (byte === 62 || byte === 47 || byte === 32 || byte === 9 || byte === 10 || byte === 13) return at
    at += 1
  }
  return -1
}

function named(bytes: Uint8Array, start: number, local: Uint8Array): boolean {
  if ((bytes[start] ?? 0) !== 60 || (bytes[start + 1] ?? 0) === 47) return false
  const end = nameEnd(bytes, start)
  if (end < 0 || end - (start + 1) < local.length) return false
  const from = end - local.length
  if (from > start + 1 && (bytes[from - 1] ?? 0) !== 58) return false
  for (let index = 0; index < local.length; index += 1) if ((bytes[from + index] ?? 0) !== local[index]) return false
  return true
}

function openTag(bytes: Uint8Array, local: string): Uint8Array | null {
  const name = encodeUtf8(local)
  let at = 0
  while (at < bytes.length) {
    const start = bytes.indexOf(60, at)
    if (start < 0) return null
    if (!named(bytes, start, name)) {
      at = start + 1
      continue
    }
    const end = tagEnd(bytes, start)
    return end < 0 ? null : bytes.subarray(start, end)
  }
  return null
}

function elementAt(bytes: Uint8Array, local: string): Uint8Array | null {
  const name = encodeUtf8(local)
  let at = 0
  while (at < bytes.length) {
    const start = bytes.indexOf(60, at)
    if (start < 0) return null
    if (!named(bytes, start, name)) {
      at = start + 1
      continue
    }
    const open = tagEnd(bytes, start)
    if (open < 0) return null
    if ((bytes[open - 2] ?? 0) === 47) return bytes.subarray(start, open)
    const ended = nameEnd(bytes, start)
    if (ended < 0) return null
    const close = new Uint8Array(ended - (start + 1) + 3)
    close[0] = 60
    close[1] = 47
    close.set(bytes.subarray(start + 1, ended), 2)
    close[close.length - 1] = 62
    const found = findBytes(bytes, close, open)
    return found < 0 ? null : bytes.subarray(start, found + close.length)
  }
  return null
}

function targetOf(bytes: Uint8Array, owner: string, type: string): string | null {
  for (const element of markupDocument(bytes).elements) {
    if (element.kind !== "Relationship" && !element.kind.endsWith(":Relationship")) continue
    const kind = paintAttribute(element, "Type")
    const target = paintAttribute(element, "Target")
    if (kind === null || target === null || target === "" || paintAttribute(element, "TargetMode") === "External")
      continue
    if (kind.endsWith(`/${type}`)) return partOf(owner, target)
  }
  return null
}

const relationshipCache = new WeakMap<Uint8Array, Map<string, string | null>>()

export function relationshipTarget(bytes: Uint8Array, owner: string, type: string): string | null {
  const cached = relationshipCache.get(bytes) ?? new Map<string, string | null>()
  if (!relationshipCache.has(bytes)) relationshipCache.set(bytes, cached)
  if (cached.has(type)) return cached.get(type) ?? null
  const found = resolveRelationship(bytes, owner, type)
  cached.set(type, found)
  return found
}

function resolveRelationship(bytes: Uint8Array, owner: string, type: string): string | null {
  const markers = [encodeUtf8(`/${type}"`), encodeUtf8(`/${type}'`)]
  let from = 0
  while (from < bytes.length) {
    let at = -1
    for (const marker of markers) {
      const found = findBytes(bytes, marker, from)
      if (found >= 0 && (at < 0 || found < at)) at = found
    }
    if (at < 0) break
    let start = at
    while (start >= 0 && (bytes[start] ?? 0) !== 60) start -= 1
    const end = start < 0 ? -1 : tagEnd(bytes, start)
    if (start < 0 || end < 0) break
    const held = targetOf(
      join([encodeUtf8("<Relationships>"), bytes.subarray(start, end), encodeUtf8("</Relationships>")]),
      owner,
      type,
    )
    if (held !== null) return held
    from = end
  }
  return targetOf(bytes, owner, type)
}

function wrappedLatin(bytes: Uint8Array, font: string): Uint8Array | null {
  const block = elementAt(bytes, font)
  const latin = block === null ? null : elementAt(block, "latin")
  if (latin === null) return null
  return join([encodeUtf8(`<a:${font}>`), latin, encodeUtf8(`</a:${font}>`)])
}

export function themeCatalog(bytes: Uint8Array): Uint8Array | null {
  const open = openTag(bytes, "theme")
  const scheme = elementAt(bytes, "clrScheme")
  if (open === null || scheme === null) return null
  return join([
    open,
    encodeUtf8("<a:themeElements>"),
    scheme,
    encodeUtf8("<a:fontScheme>"),
    wrappedLatin(bytes, "majorFont") ?? encodeUtf8(""),
    wrappedLatin(bytes, "minorFont") ?? encodeUtf8(""),
    encodeUtf8("</a:fontScheme></a:themeElements></a:theme>"),
  ])
}

export function colorMapCatalog(bytes: Uint8Array): Uint8Array | null {
  const tag = openTag(bytes, "clrMap")
  if (tag === null) return null
  return join([encodeUtf8("<p:sldMaster>"), tag, encodeUtf8("</p:sldMaster>")])
}

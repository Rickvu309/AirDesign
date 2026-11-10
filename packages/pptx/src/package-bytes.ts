import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js"

type Relationship = { readonly target: string; readonly external: boolean }

function tagEnd(xml: string, from: number): number {
  let quote: string | null = null
  for (let index = from; index < xml.length; index += 1) {
    const char = xml[index]
    if (quote !== null) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === ">") return index
  }
  throw new Error("unclosed tag")
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag)
  return match?.[1] ?? null
}

function readRelationships(xml: string): readonly Relationship[] {
  const found: Relationship[] = []
  const name = "<Relationship"
  let index = 0
  while (index < xml.length) {
    const at = xml.indexOf(name, index)
    if (at < 0) break
    const next = xml[at + name.length]
    if (next !== " " && next !== "\n" && next !== "\t" && next !== "/" && next !== ">") {
      index = at + name.length
      continue
    }
    const end = tagEnd(xml, at)
    const tag = xml.slice(at, end + 1)
    const target = attribute(tag, "Target")
    if (target === null) throw new Error("relationship target")
    found.push({ target, external: attribute(tag, "TargetMode") === "External" })
    index = end + 1
  }
  return found
}

export function keepRelationships(xml: string, targetExists: (target: string) => boolean): string {
  for (const relationship of readRelationships(xml)) {
    if (relationship.external) continue
    if (targetExists(relationship.target)) continue
    return xml
  }
  return xml
}

function sourcePart(relsName: string): string {
  if (relsName === "_rels/.rels") return ""
  const marker = "/_rels/"
  const at = relsName.lastIndexOf(marker)
  if (at < 0 || !relsName.endsWith(".rels")) throw new Error(`rels ${relsName}`)
  const file = relsName.slice(at + marker.length, -".rels".length)
  return `${relsName.slice(0, at)}/${file}`
}

function resolveTarget(source: string, target: string): string {
  const parts = source === "" ? [] : source.split("/").slice(0, -1)
  for (const piece of target.split("/")) {
    if (piece === "" || piece === ".") continue
    if (piece === "..") {
      parts.pop()
      continue
    }
    parts.push(piece)
  }
  return parts.join("/")
}

function encodeUtf8(text: string): Uint8Array {
  const units: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index)
    const next = text.charCodeAt(index + 1)
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
      index += 1
    }
    if (code < 0x80) units.push(code)
    else if (code < 0x800) units.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) units.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    else
      units.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
  }
  return Uint8Array.from(units)
}

function decodeUtf8(bytes: Uint8Array): string {
  let text = ""
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index]
    if (first === undefined) throw new Error("byte")
    if (first < 0x80) {
      text += String.fromCharCode(first)
      index += 1
      continue
    }
    const width = first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4
    let code = first & (width === 2 ? 0x1f : width === 3 ? 0x0f : 0x07)
    for (let extra = 1; extra < width; extra += 1) {
      const next = bytes[index + extra]
      if (next === undefined || (next & 0xc0) !== 0x80) throw new Error("utf8")
      code = (code << 6) | (next & 0x3f)
    }
    text += String.fromCodePoint(code)
    index += width
  }
  return text
}

export async function readParts(bytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  const entries = await reader.getEntries()
  const parts = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (entry.directory) continue
    parts.set(entry.filename, await entry.getData(new Uint8ArrayWriter()))
  }
  await reader.close()
  return parts
}

export async function writeParts(parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter())
  for (const [name, data] of parts) {
    await writer.add(name, new Uint8ArrayReader(data))
  }
  return writer.close()
}

export async function roundTripPackage(bytes: Uint8Array): Promise<Uint8Array> {
  const parts = await readParts(bytes)
  const names = new Set(parts.keys())
  const next = new Map<string, Uint8Array>()
  for (const [name, data] of parts) {
    if (!name.endsWith(".rels")) {
      next.set(name, data)
      continue
    }
    const xml = decodeUtf8(data)
    const source = sourcePart(name)
    const kept = keepRelationships(xml, (target) => names.has(resolveTarget(source, target)))
    next.set(name, kept === xml ? data : encodeUtf8(kept))
  }
  return writeParts(next)
}

import { limits } from "@airdesign/document"
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { markupLimits, markupReady } from "./element-span.js"

export const packageLimits = {
  packedBytes: limits.bytes,
  slides: limits.slides,
  unpackedBytes: 500 * 1024 * 1024,
  parts: 10_000,
  xmlBytes: 8 * 1024 * 1024,
  binaryBytes: 64 * 1024 * 1024,
  depth: 128,
  attributes: 256,
  nodes: 500_000,
  ratio: 100,
} as const

export type PackageLimitName = keyof typeof packageLimits

export type ReadPackage =
  | { readonly ok: true; readonly parts: ReadonlyMap<string, Uint8Array> }
  | { readonly ok: false; readonly reason: "limit"; readonly limit: PackageLimitName }
  | { readonly ok: false; readonly reason: "encrypted" | "not-pptx" | "xml" | "zip" }

function overLimit(limit: PackageLimitName): ReadPackage {
  return { ok: false, reason: "limit", limit }
}

function sizeLimit(name: string, size: number): ReadPackage | null {
  const cap = xmlPart(name) ? packageLimits.xmlBytes : packageLimits.binaryBytes
  if (size > cap) return overLimit(xmlPart(name) ? "xmlBytes" : "binaryBytes")
  return null
}

function xmlPart(name: string): boolean {
  return name.endsWith(".xml") || name.endsWith(".rels")
}

function slidePart(name: string): boolean {
  return /^ppt\/slides\/slide\d+\.xml$/.test(name)
}

export async function readPackage(bytes: Uint8Array): Promise<ReadPackage> {
  if (bytes.length >= packageLimits.packedBytes) return overLimit("packedBytes")
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  try {
    let entries
    try {
      entries = await reader.getEntries()
    } catch {
      return { ok: false, reason: "zip" }
    }
    const files = entries.filter((entry) => !entry.directory)
    let slides = 0
    let unpacked = 0
    for (const entry of files) {
      if (slidePart(entry.filename)) slides += 1
      const declared = sizeLimit(entry.filename, entry.uncompressedSize)
      if (declared !== null) return declared
      if (entry.compressionMethod === 0) {
        const stored = sizeLimit(entry.filename, entry.compressedSize)
        if (stored !== null) return stored
      }
      unpacked += entry.uncompressedSize
    }
    if (files.length > packageLimits.parts) return overLimit("parts")
    if (slides > packageLimits.slides) return overLimit("slides")
    if (!Number.isSafeInteger(unpacked) || unpacked > packageLimits.unpackedBytes) return overLimit("unpackedBytes")
    if (unpacked > bytes.length * packageLimits.ratio) return overLimit("ratio")
    if (files.some((entry) => entry.encrypted)) return { ok: false, reason: "encrypted" }
    const names = new Set(files.map((entry) => entry.filename))
    if (!names.has("[Content_Types].xml") || !names.has("ppt/presentation.xml")) {
      return { ok: false, reason: "not-pptx" }
    }
    const parts = new Map<string, Uint8Array>()
    let nodes = 0
    await markupReady()
    for (const entry of files) {
      if (entry.directory) continue
      let data: Uint8Array
      try {
        data = await entry.getData(new Uint8ArrayWriter())
      } catch {
        return { ok: false, reason: "zip" }
      }
      const actual = sizeLimit(entry.filename, data.length)
      if (actual !== null) return actual
      parts.set(entry.filename, data)
      if (!xmlPart(entry.filename)) continue
      const shape = markupLimits(data)
      if (!shape.wellFormed) return { ok: false, reason: "xml" }
      if (shape.depth > packageLimits.depth) return overLimit("depth")
      if (shape.attributes > packageLimits.attributes) return overLimit("attributes")
      nodes += shape.nodes
      if (nodes > packageLimits.nodes) return overLimit("nodes")
    }
    return { ok: true, parts }
  } finally {
    await reader.close()
  }
}

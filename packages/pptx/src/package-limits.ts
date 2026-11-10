import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { decodeLatin1 } from "./package-bytes.js"

export const packageLimits = {
  packedBytes: 70_000_000,
  slides: 50,
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

function xmlPart(name: string): boolean {
  return name.endsWith(".xml") || name.endsWith(".rels")
}

function slidePart(name: string): boolean {
  return /^ppt\/slides\/slide\d+\.xml$/.test(name)
}

function tagEnd(xml: string, from: number): number | null {
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
  return null
}

function elementName(tag: string, closing: boolean): string | null {
  let index = closing ? 2 : 1
  const start = index
  while (index < tag.length) {
    const char = tag[index]
    if (
      char === undefined ||
      char === " " ||
      char === "\n" ||
      char === "\t" ||
      char === "\r" ||
      char === "/" ||
      char === ">"
    ) {
      break
    }
    index += 1
  }
  if (index === start) return null
  return tag.slice(start, index)
}

function emptyElement(tag: string): boolean {
  let index = tag.length - 2
  while (index > 0 && (tag[index] === " " || tag[index] === "\n" || tag[index] === "\t" || tag[index] === "\r")) {
    index -= 1
  }
  return tag[index] === "/"
}

function attributeCount(tag: string): number {
  let index = 0
  while (index < tag.length) {
    const char = tag[index]
    if (char === " " || char === "\n" || char === "\t" || char === "\r") break
    index += 1
  }
  let count = 0
  while (index < tag.length) {
    const char = tag[index]
    if (char === undefined) break
    if (char === " " || char === "\n" || char === "\t" || char === "\r" || char === "/" || char === ">") {
      index += 1
      continue
    }
    count += 1
    while (index < tag.length) {
      const next = tag[index]
      if (
        next === undefined ||
        next === " " ||
        next === "\n" ||
        next === "\t" ||
        next === "\r" ||
        next === "=" ||
        next === "/" ||
        next === ">"
      ) {
        break
      }
      index += 1
    }
    while (
      index < tag.length &&
      (tag[index] === " " || tag[index] === "\t" || tag[index] === "\n" || tag[index] === "\r")
    ) {
      index += 1
    }
    if (tag[index] !== "=") continue
    index += 1
    while (index < tag.length && (tag[index] === " " || tag[index] === "\t")) index += 1
    const quote = tag[index]
    if (quote !== '"' && quote !== "'") continue
    index += 1
    while (index < tag.length && tag[index] !== quote) index += 1
    if (index < tag.length) index += 1
  }
  return count
}

function skipMarked(xml: string, index: number, open: string, close: string): number | null {
  if (!xml.startsWith(open, index)) return index
  const end = xml.indexOf(close, index + open.length)
  if (end < 0) return null
  return end + close.length
}

type XmlShape = {
  readonly depth: number
  readonly attributes: number
  readonly nodes: number
  readonly wellFormed: boolean
}

function xmlShape(xml: string): XmlShape {
  const stack: string[] = []
  let maxDepth = 0
  let maxAttributes = 0
  let nodes = 0
  let index = 0
  while (index < xml.length) {
    if (xml[index] !== "<") {
      index += 1
      continue
    }
    const comment = skipMarked(xml, index, "<!--", "-->")
    const instruction = comment === index ? skipMarked(xml, index, "<?", "?>") : comment
    const cdata = instruction === index ? skipMarked(xml, index, "<![CDATA[", "]]>") : instruction
    if (cdata === null) return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: false }
    if (cdata !== index) {
      index = cdata
      continue
    }
    if (xml.startsWith("<!", index)) {
      const end = tagEnd(xml, index)
      if (end === null) return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: false }
      index = end + 1
      continue
    }
    const end = tagEnd(xml, index)
    if (end === null) return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: false }
    const tag = xml.slice(index, end + 1)
    const closing = tag.startsWith("</")
    const name = elementName(tag, closing)
    if (name === null) return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: false }
    if (closing) {
      if (stack.pop() !== name) return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: false }
    } else {
      nodes += 1
      const attributes = attributeCount(tag)
      if (attributes > maxAttributes) maxAttributes = attributes
      if (!emptyElement(tag)) {
        stack.push(name)
        if (stack.length > maxDepth) maxDepth = stack.length
      } else if (stack.length + 1 > maxDepth) {
        maxDepth = stack.length + 1
      }
    }
    index = end + 1
  }
  return { depth: maxDepth, attributes: maxAttributes, nodes, wellFormed: stack.length === 0 }
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
      const cap = xmlPart(entry.filename) ? packageLimits.xmlBytes : packageLimits.binaryBytes
      if (entry.uncompressedSize > cap) return overLimit(xmlPart(entry.filename) ? "xmlBytes" : "binaryBytes")
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
    for (const entry of files) {
      if (entry.directory) continue
      let data: Uint8Array
      try {
        data = await entry.getData(new Uint8ArrayWriter())
      } catch {
        return { ok: false, reason: "zip" }
      }
      const cap = xmlPart(entry.filename) ? packageLimits.xmlBytes : packageLimits.binaryBytes
      if (data.length > cap) return overLimit(xmlPart(entry.filename) ? "xmlBytes" : "binaryBytes")
      parts.set(entry.filename, data)
      if (!xmlPart(entry.filename)) continue
      const shape = xmlShape(decodeLatin1(data))
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

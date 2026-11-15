import { limits } from "@airdesign/document"
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, type FileEntry } from "@zip.js/zip.js"
import { markupLimits } from "./element-span.js"
import { presentationPart } from "./package-address.js"
import { partData, plainContainer, stored } from "./package-container.js"

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

export type PackageLimits = Readonly<Record<PackageLimitName, number>>

export type ReadPackage =
  | { readonly ok: true; readonly parts: ReadonlyMap<string, Uint8Array> }
  | { readonly ok: false; readonly reason: "limit"; readonly limit: PackageLimitName }
  | { readonly ok: false; readonly reason: "encrypted" | "not-pptx" | "xml" | "zip" }

export type MarkupLimits = { readonly depth: number; readonly attributes: number; readonly nodes: number }

export type MarkupScan =
  | { readonly ok: true; readonly nodes: number }
  | { readonly ok: false; readonly reason: "xml" }
  | { readonly ok: false; readonly reason: "limit"; readonly limit: "depth" | "attributes" | "nodes" }

export function scanMarkup(data: Uint8Array, limits: MarkupLimits, nodesBefore: number): MarkupScan {
  const shape = markupLimits(data)
  if (!shape.wellFormed) return { ok: false, reason: "xml" }
  if (shape.depth > limits.depth) return { ok: false, reason: "limit", limit: "depth" }
  if (shape.attributes > limits.attributes) return { ok: false, reason: "limit", limit: "attributes" }
  const nodes = nodesBefore + shape.nodes
  if (nodes > limits.nodes) return { ok: false, reason: "limit", limit: "nodes" }
  return { ok: true, nodes }
}

function overLimit(limit: PackageLimitName): ReadPackage {
  return { ok: false, reason: "limit", limit }
}

function xmlPart(name: string): boolean {
  return name.endsWith(".xml") || name.endsWith(".rels")
}

function sizeLimit(name: string, size: number, limits: PackageLimits): ReadPackage | null {
  const cap = xmlPart(name) ? limits.xmlBytes : limits.binaryBytes
  if (size > cap) return overLimit(xmlPart(name) ? "xmlBytes" : "binaryBytes")
  return null
}

function slidePart(name: string): boolean {
  return /^ppt\/slides\/slide\d+\.xml$/.test(name)
}

type PackageFile = {
  readonly name: string
  readonly size: number
  readonly packedSize: number
  readonly stored: boolean
  readonly encrypted: boolean
  readonly data: () => Promise<Uint8Array | undefined>
}

async function readFiles(
  files: readonly PackageFile[],
  packedBytes: number,
  limits: PackageLimits,
): Promise<ReadPackage | undefined> {
  let slides = 0
  let unpacked = 0
  for (const file of files) {
    if (slidePart(file.name)) slides += 1
    const declared = sizeLimit(file.name, file.size, limits)
    if (declared !== null) return declared
    if (file.stored) {
      const packed = sizeLimit(file.name, file.packedSize, limits)
      if (packed !== null) return packed
    }
    unpacked += file.size
  }
  if (files.length > limits.parts) return overLimit("parts")
  if (slides > limits.slides) return overLimit("slides")
  if (!Number.isSafeInteger(unpacked) || unpacked > limits.unpackedBytes) return overLimit("unpackedBytes")
  if (unpacked > packedBytes * limits.ratio) return overLimit("ratio")
  if (files.some((file) => file.encrypted)) return { ok: false, reason: "encrypted" }
  const names = new Set(files.map((file) => file.name))
  if (!names.has("[Content_Types].xml") || !names.has(presentationPart)) {
    return { ok: false, reason: "not-pptx" }
  }
  const parts = new Map<string, Uint8Array>()
  let nodes = 0
  for (const file of files) {
    const data = await file.data()
    if (data === undefined) return undefined
    const actual = sizeLimit(file.name, data.length, limits)
    if (actual !== null) return actual
    parts.set(file.name, data)
    if (!xmlPart(file.name)) continue
    const scan = scanMarkup(data, limits, nodes)
    if (!scan.ok) return scan
    nodes = scan.nodes
  }
  return { ok: true, parts }
}

function plainFiles(bytes: Uint8Array): readonly PackageFile[] | undefined {
  const records = plainContainer(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  return records?.map((record) => ({
    name: record.name,
    size: record.size,
    packedSize: record.stream.length,
    stored: record.method === stored,
    encrypted: false,
    data: async () => partData(record),
  }))
}

async function entryData(entry: FileEntry): Promise<Uint8Array | undefined> {
  try {
    return await entry.getData(new Uint8ArrayWriter())
  } catch {
    return undefined
  }
}

async function zipRead(bytes: Uint8Array, limits: PackageLimits): Promise<ReadPackage> {
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  try {
    let entries
    try {
      entries = await reader.getEntries()
    } catch {
      return { ok: false, reason: "zip" }
    }
    const files = entries.flatMap((entry): PackageFile[] =>
      entry.directory
        ? []
        : [
            {
              name: entry.filename,
              size: entry.uncompressedSize,
              packedSize: entry.compressedSize,
              stored: entry.compressionMethod === stored,
              encrypted: entry.encrypted,
              data: () => entryData(entry),
            },
          ],
    )
    return (await readFiles(files, bytes.length, limits)) ?? { ok: false, reason: "zip" }
  } finally {
    await reader.close()
  }
}

export async function readPackageWith(bytes: Uint8Array, limits: PackageLimits): Promise<ReadPackage> {
  if (bytes.length >= limits.packedBytes) return overLimit("packedBytes")
  const plain = plainFiles(bytes)
  const read = plain === undefined ? undefined : await readFiles(plain, bytes.length, limits)
  return read ?? (await zipRead(bytes, limits))
}

export function readPackage(bytes: Uint8Array): Promise<ReadPackage> {
  return readPackageWith(bytes, packageLimits)
}

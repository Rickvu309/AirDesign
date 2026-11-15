import type { Configuration } from "@zip.js/zip.js"
import { decodeLatin1, decodeUtf8, sameBytes } from "./package-bytes.js"
import { crc32 } from "./crc32.js"
import { inflate } from "./part-inflate.js"

export type ContainerKind =
  | "comment"
  | "content"
  | "directory"
  | "disk"
  | "duplicate"
  | "method"
  | "order"
  | "unaccounted"
  | "unreadable"
  | "zip64"

export class ContainerError extends Error {
  readonly kind: ContainerKind

  constructor(kind: ContainerKind) {
    super(`container ${kind}`)
    this.name = "ContainerError"
    this.kind = kind
  }
}

export const onlyBundledCompressor = { CompressionStream: false } as unknown as Configuration
export const localSignature = 0x04034b50
export const centralSignature = 0x02014b50
const endSignature = 0x06054b50
const locatorSignature = 0x07064b50
const descriptorSignature = 0x08074b50
export const localSize = 30
export const centralSize = 46
export const endSize = 22
const locatorSize = 20
export const stored = 0
export const deflate = 8
export const descriptorFlag = 0x8
export const utf8Flag = 0x800
const encryptedFlags = 0x2041
const nameFlags = descriptorFlag | utf8Flag | encryptedFlags
export const most16 = 0xffff
export const most32 = 0xffffffff
const zip64Extra = 0x0001
const unicodePathExtra = 0x7075
const directoryAttribute = 0x10
const unixTypeMask = 0xf000
const unixDirectory = 0x4000

export type ContainerRecord = {
  readonly name: string
  readonly directory: boolean
  readonly method: number
  readonly flags: number
  readonly crc: number
  readonly size: number
  readonly header: Uint8Array
  readonly stream: Uint8Array
  readonly local: Uint8Array
  readonly central: Uint8Array
}

type CentralRow = {
  readonly name: string
  readonly directory: boolean
  readonly method: number
  readonly flags: number
  readonly crc: number
  readonly compressed: number
  readonly size: number
  readonly offset: number
  readonly at: number
  readonly nameBytes: Uint8Array
  readonly central: Uint8Array
}

type Span = readonly [start: number, end: number]

export function recordView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function endRecordAt(view: DataView, length: number): number {
  for (let at = length - endSize; at >= 0 && at >= length - endSize - most16; at -= 1) {
    if (view.getUint32(at, true) === endSignature) return at
  }
  throw new ContainerError("unreadable")
}

function endFields(view: DataView, at: number) {
  return {
    disk: view.getUint16(at + 4, true),
    startDisk: view.getUint16(at + 6, true),
    here: view.getUint16(at + 8, true),
    count: view.getUint16(at + 10, true),
    length: view.getUint32(at + 12, true),
    offset: view.getUint32(at + 16, true),
    comment: view.getUint16(at + 20, true),
  }
}

function checkedExtra(view: DataView, start: number, end: number): void {
  let cursor = start
  while (cursor < end) {
    if (cursor + 4 > end) throw new ContainerError("unreadable")
    const id = view.getUint16(cursor, true)
    const next = cursor + 4 + view.getUint16(cursor + 2, true)
    if (next > end) throw new ContainerError("unreadable")
    if (id === zip64Extra) throw new ContainerError("zip64")
    if (id === unicodePathExtra) throw new ContainerError("unreadable")
    cursor = next
  }
}

function partName(nameBytes: Uint8Array, flags: number): string {
  if ((flags & utf8Flag) !== 0) {
    try {
      return decodeUtf8(nameBytes)
    } catch {
      throw new ContainerError("unreadable")
    }
  }
  if (nameBytes.some((byte) => byte >= 0x80)) throw new ContainerError("unreadable")
  return decodeLatin1(nameBytes)
}

function centralRows(file: Uint8Array, view: DataView, start: number, endAt: number, count: number) {
  const rows: CentralRow[] = []
  const names = new Set<string>()
  let cursor = start
  for (let index = 0; index < count; index += 1) {
    if (cursor + centralSize > endAt || view.getUint32(cursor, true) !== centralSignature) {
      throw new ContainerError("unreadable")
    }
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compressed = view.getUint32(cursor + 20, true)
    const size = view.getUint32(cursor + 24, true)
    const nameEnd = cursor + centralSize + view.getUint16(cursor + 28, true)
    const extraEnd = nameEnd + view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const external = view.getUint32(cursor + 38, true)
    const offset = view.getUint32(cursor + 42, true)
    if (extraEnd + commentLength > endAt) throw new ContainerError("unreadable")
    if (commentLength !== 0) throw new ContainerError("comment")
    if (view.getUint16(cursor + 34, true) !== 0) throw new ContainerError("disk")
    if (compressed === most32 || size === most32 || offset === most32) throw new ContainerError("zip64")
    checkedExtra(view, nameEnd, extraEnd)
    if ((flags & encryptedFlags) !== 0) throw new ContainerError("method")
    if (method !== stored && method !== deflate) throw new ContainerError("method")
    const nameBytes = file.subarray(cursor + centralSize, nameEnd)
    const name = partName(nameBytes, flags)
    const folded = name.toLowerCase()
    if (names.has(folded)) throw new ContainerError("duplicate")
    names.add(folded)
    const directory =
      name.endsWith("/") ||
      (external & directoryAttribute) !== 0 ||
      ((external >>> 16) & unixTypeMask) === unixDirectory
    rows.push({
      name,
      directory,
      method,
      flags,
      crc: view.getUint32(cursor + 16, true),
      compressed,
      size,
      offset,
      at: cursor,
      nameBytes,
      central: file.subarray(cursor, extraEnd),
    })
    cursor = extraEnd
  }
  return rows
}

function descriptorEnd(view: DataView, row: CentralRow, at: number, limit: number): number {
  const signed = at + 16 <= limit && view.getUint32(at, true) === descriptorSignature
  const fields = signed ? at + 4 : at
  if (
    fields + 12 <= limit &&
    view.getUint32(fields, true) === row.crc &&
    view.getUint32(fields + 4, true) === row.compressed &&
    view.getUint32(fields + 8, true) === row.size
  ) {
    return fields + 12
  }
  throw new ContainerError("unaccounted")
}

function localRecord(file: Uint8Array, view: DataView, row: CentralRow, centralAt: number): ContainerRecord {
  const at = row.offset
  if (at + localSize > centralAt || view.getUint32(at, true) !== localSignature) {
    throw new ContainerError("unreadable")
  }
  const flags = view.getUint16(at + 6, true)
  const method = view.getUint16(at + 8, true)
  const nameEnd = at + localSize + view.getUint16(at + 26, true)
  const headerEnd = nameEnd + view.getUint16(at + 28, true)
  const streamEnd = headerEnd + row.compressed
  if (streamEnd > centralAt) throw new ContainerError("unreadable")
  if (!sameBytes(file.subarray(at + localSize, nameEnd), row.nameBytes)) throw new ContainerError("unreadable")
  if (method !== row.method || (flags & nameFlags) !== (row.flags & nameFlags)) {
    throw new ContainerError("unreadable")
  }
  checkedExtra(view, nameEnd, headerEnd)
  const described = (row.flags & descriptorFlag) !== 0
  const sizes: readonly (readonly [number, number])[] = [
    [view.getUint32(at + 14, true), row.crc],
    [view.getUint32(at + 18, true), row.compressed],
    [view.getUint32(at + 22, true), row.size],
  ]
  if (sizes.some(([local, central]) => local !== central && !(described && local === 0))) {
    throw new ContainerError("unreadable")
  }
  const end = described ? descriptorEnd(view, row, streamEnd, centralAt) : streamEnd
  return {
    name: row.name,
    directory: row.directory,
    method,
    flags,
    crc: row.crc,
    size: row.size,
    header: file.subarray(at, headerEnd),
    stream: file.subarray(headerEnd, streamEnd),
    local: file.subarray(at, end),
    central: row.central,
  }
}

function accounted(spans: readonly Span[], fileLength: number): void {
  let cursor = 0
  for (const [start, end] of spans) {
    if (start !== cursor) throw new ContainerError("unaccounted")
    cursor = end
  }
  if (cursor !== fileLength) throw new ContainerError("unaccounted")
}

export function readContainer(file: Uint8Array): readonly ContainerRecord[] {
  const view = recordView(file)
  const endAt = endRecordAt(view, file.length)
  const end = endFields(view, endAt)
  if (endAt + endSize + end.comment !== file.length) throw new ContainerError("unaccounted")
  if (end.comment !== 0) throw new ContainerError("comment")
  if (end.here === most16 || end.count === most16 || end.length === most32 || end.offset === most32) {
    throw new ContainerError("zip64")
  }
  if (end.disk !== 0 || end.startDisk !== 0 || end.here !== end.count) throw new ContainerError("disk")
  if (end.offset + end.length !== endAt) {
    const zip64 = endAt >= locatorSize && view.getUint32(endAt - locatorSize, true) === locatorSignature
    throw new ContainerError(zip64 ? "zip64" : "unaccounted")
  }
  const rows = centralRows(file, view, end.offset, endAt, end.count)
  rows.forEach((row, index) => {
    const before = rows[index - 1]
    if (before !== undefined && row.offset <= before.offset) throw new ContainerError("order")
  })
  const records = rows.map((row) => localRecord(file, view, row, end.offset))
  accounted(
    [
      ...rows.map((row, index): Span => [row.offset, row.offset + (records[index]?.local.length ?? 0)]),
      ...rows.map((row): Span => [row.at, row.at + row.central.length]),
      [endAt, file.length],
    ],
    file.length,
  )
  return records
}

function unpacked(record: ContainerRecord): Uint8Array {
  const data = record.method === stored ? record.stream.slice() : inflate(record.stream, record.size)
  if (data === undefined || data.length !== record.size || crc32(data) !== record.crc)
    throw new ContainerError("content")
  return data
}

export async function readParts(bytes: Uint8Array): Promise<ReadonlyMap<string, Uint8Array>> {
  const file = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts = new Map<string, Uint8Array>()
  for (const record of readContainer(file)) {
    if (record.directory) throw new ContainerError("directory")
    parts.set(record.name, unpacked(record))
  }
  return parts
}

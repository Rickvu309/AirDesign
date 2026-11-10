import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter } from "@zip.js/zip.js"
import { encodeUtf8, readParts, sameBytes } from "./package-bytes.js"

export type ContainerKind =
  | "comment"
  | "disk"
  | "duplicate"
  | "gap"
  | "method"
  | "order"
  | "trailing"
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

const localSignature = 0x04034b50
const centralSignature = 0x02014b50
const endSignature = 0x06054b50
const locatorSignature = 0x07064b50
const descriptorSignature = 0x08074b50
const localSize = 30
const centralSize = 46
const endSize = 22
const locatorSize = 20
const centralShift = 2
const stored = 0
const deflate = 8
const descriptorFlag = 0x8
const utf8Flag = 0x800
const most16 = 0xffff
const most32 = 0xffffffff
const packLevel = 6
const madeByVersion = 20
const fixedDate = 0x21

type Original = {
  readonly name: string
  readonly directory: boolean
  readonly method: number
  readonly flags: number
  readonly header: Uint8Array
  readonly local: Uint8Array
  readonly central: Uint8Array
}

type Piece = { readonly local: Uint8Array; readonly central: Uint8Array }

type Pack = { readonly stream: Uint8Array; readonly crc: number; readonly size: number; readonly method: number }

function recordView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function zipEntries(original: Uint8Array) {
  const reader = new ZipReader(new Uint8ArrayReader(original))
  try {
    const entries = await reader.getEntries()
    return { entries, comment: reader.comment }
  } catch {
    return null
  } finally {
    await reader.close()
  }
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
  readonly nameBytes: Uint8Array
  readonly central: Uint8Array
}

function endFields(view: DataView, at: number) {
  return {
    disk: view.getUint16(at + 4, true),
    startDisk: view.getUint16(at + 6, true),
    here: view.getUint16(at + 8, true),
    count: view.getUint16(at + 10, true),
    length: view.getUint32(at + 12, true),
    offset: view.getUint32(at + 16, true),
  }
}

function centralRows(
  original: Uint8Array,
  view: DataView,
  entries: readonly { readonly filename: string; readonly directory: boolean; readonly offset: number }[],
  start: number,
): readonly CentralRow[] {
  const rows: CentralRow[] = []
  let cursor = start
  for (const entry of entries) {
    if (cursor + centralSize > original.length || view.getUint32(cursor, true) !== centralSignature) {
      throw new ContainerError("unreadable")
    }
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compressed = view.getUint32(cursor + 20, true)
    const size = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const offset = view.getUint32(cursor + 42, true)
    if (commentLength !== 0) throw new ContainerError("comment")
    if (view.getUint16(cursor + 34, true) !== 0) throw new ContainerError("disk")
    if (compressed === most32 || size === most32 || offset === most32) throw new ContainerError("zip64")
    if (method !== stored && method !== deflate) throw new ContainerError("method")
    if (offset !== entry.offset) throw new ContainerError("unreadable")
    const end = cursor + centralSize + nameLength + extraLength
    rows.push({
      name: entry.filename,
      directory: entry.directory,
      method,
      flags,
      crc: view.getUint32(cursor + 16, true),
      compressed,
      size,
      offset,
      nameBytes: original.subarray(cursor + centralSize, cursor + centralSize + nameLength),
      central: original.subarray(cursor, end),
    })
    cursor = end
  }
  return rows
}

function descriptorMatches(view: DataView, row: CentralRow, at: number, length: number): boolean {
  if (length !== 12 && length !== 16) return false
  if (length === 16 && view.getUint32(at, true) !== descriptorSignature) return false
  const fields = at + length - 12
  return (
    view.getUint32(fields, true) === row.crc &&
    view.getUint32(fields + 4, true) === row.compressed &&
    view.getUint32(fields + 8, true) === row.size
  )
}

function localRecord(original: Uint8Array, view: DataView, row: CentralRow, next: number, centralAt: number): Original {
  if (row.offset + localSize > centralAt || view.getUint32(row.offset, true) !== localSignature) {
    throw new ContainerError("unreadable")
  }
  const flags = view.getUint16(row.offset + 6, true)
  const method = view.getUint16(row.offset + 8, true)
  const nameLength = view.getUint16(row.offset + 26, true)
  const extraLength = view.getUint16(row.offset + 28, true)
  const headerEnd = row.offset + localSize + nameLength + extraLength
  const streamEnd = headerEnd + row.compressed
  if (streamEnd > next) throw new ContainerError("unreadable")
  const localName = original.subarray(row.offset + localSize, row.offset + localSize + nameLength)
  if (!sameBytes(localName, row.nameBytes)) throw new ContainerError("unreadable")
  if (method !== row.method || (flags & descriptorFlag) !== (row.flags & descriptorFlag)) {
    throw new ContainerError("unreadable")
  }
  const trail = next - streamEnd
  if ((flags & descriptorFlag) === 0) {
    if (trail !== 0) throw new ContainerError("gap")
  } else if (!descriptorMatches(view, row, streamEnd, trail)) {
    throw new ContainerError("gap")
  }
  return {
    name: row.name,
    directory: row.directory,
    method,
    flags,
    header: original.subarray(row.offset, headerEnd),
    local: original.subarray(row.offset, next),
    central: row.central,
  }
}

function severalDisks(view: DataView, endAt: number): boolean {
  const end = endFields(view, endAt)
  return end.disk !== 0 || end.startDisk !== 0 || end.here !== end.count
}

async function readContainer(original: Uint8Array): Promise<readonly Original[]> {
  const view = recordView(original)
  const endAt = original.length - endSize
  const hasEnd = endAt >= 0 && view.getUint32(endAt, true) === endSignature
  const read = await zipEntries(original)
  if (read === null) throw new ContainerError(hasEnd && severalDisks(view, endAt) ? "disk" : "unreadable")
  if (read.comment.length > 0) throw new ContainerError("comment")
  if (read.entries.some((entry) => entry.zip64)) throw new ContainerError("zip64")
  if (!hasEnd) throw new ContainerError("trailing")
  if (severalDisks(view, endAt)) throw new ContainerError("disk")
  const end = endFields(view, endAt)
  if (end.count === most16 || end.length === most32 || end.offset === most32) throw new ContainerError("zip64")
  if (end.offset + end.length !== endAt) {
    const zip64 = endAt >= locatorSize && view.getUint32(endAt - locatorSize, true) === locatorSignature
    throw new ContainerError(zip64 ? "zip64" : "gap")
  }
  if (end.count !== read.entries.length) throw new ContainerError("unreadable")
  const rows = centralRows(original, view, read.entries, end.offset)
  rows.forEach((row, index) => {
    const before = rows[index - 1]
    if (before !== undefined && row.offset <= before.offset) throw new ContainerError("order")
  })
  const first = rows[0]
  if (first !== undefined && first.offset !== 0) throw new ContainerError("gap")
  return rows.map((row, index) => localRecord(original, view, row, rows[index + 1]?.offset ?? end.offset, end.offset))
}

async function packPart(data: Uint8Array, method: number): Promise<Pack> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter(), {
    level: method === stored ? 0 : packLevel,
    useWebWorkers: false,
    useCompressionStream: false,
    dataDescriptor: false,
    zip64: false,
    extendedTimestamp: false,
  })
  await writer.add("p", new Uint8ArrayReader(data))
  const zipped = await writer.close()
  const view = recordView(zipped)
  const compressed = view.getUint32(18, true)
  const start = localSize + view.getUint16(26, true) + view.getUint16(28, true)
  return {
    stream: zipped.slice(start, start + compressed),
    crc: view.getUint32(14, true),
    size: data.length,
    method: view.getUint16(8, true),
  }
}

function stampPack(view: DataView, shift: number, flags: number, pack: Pack): void {
  view.setUint16(6 + shift, flags, true)
  view.setUint16(8 + shift, pack.method, true)
  view.setUint32(14 + shift, pack.crc, true)
  view.setUint32(18 + shift, pack.stream.length, true)
  view.setUint32(22 + shift, pack.size, true)
}

function joined(head: Uint8Array, tail: Uint8Array): Uint8Array {
  const whole = new Uint8Array(head.length + tail.length)
  whole.set(head, 0)
  whole.set(tail, head.length)
  return whole
}

async function changedPiece(original: Original, data: Uint8Array): Promise<Piece> {
  const pack = await packPart(data, original.method)
  const flags = original.flags & ~descriptorFlag
  const header = original.header.slice()
  stampPack(recordView(header), 0, flags, pack)
  const central = original.central.slice()
  stampPack(recordView(central), centralShift, flags, pack)
  return { local: joined(header, pack.stream), central }
}

async function addedPiece(name: string, data: Uint8Array): Promise<Piece> {
  const pack = await packPart(data, deflate)
  const nameBytes = encodeUtf8(name)
  const flags = nameBytes.length === name.length ? 0 : utf8Flag
  const header = new Uint8Array(localSize + nameBytes.length)
  header.set(nameBytes, localSize)
  const local = recordView(header)
  local.setUint32(0, localSignature, true)
  local.setUint16(4, madeByVersion, true)
  local.setUint16(12, fixedDate, true)
  local.setUint16(26, nameBytes.length, true)
  stampPack(local, 0, flags, pack)
  const central = new Uint8Array(centralSize + nameBytes.length)
  central.set(header.subarray(4, localSize), 4 + centralShift)
  central.set(nameBytes, centralSize)
  const view = recordView(central)
  view.setUint32(0, centralSignature, true)
  view.setUint16(4, madeByVersion, true)
  return { local: joined(header, pack.stream), central }
}

function assembled(pieces: readonly Piece[], originalEnd: Uint8Array): Uint8Array {
  const localLength = pieces.reduce((total, piece) => total + piece.local.length, 0)
  const centralLength = pieces.reduce((total, piece) => total + piece.central.length, 0)
  const total = localLength + centralLength + endSize
  if (total >= most32 || pieces.length >= most16) throw new ContainerError("zip64")
  const whole = new Uint8Array(total)
  let localCursor = 0
  let centralCursor = localLength
  for (const piece of pieces) {
    whole.set(piece.local, localCursor)
    const central = piece.central.slice()
    recordView(central).setUint32(42, localCursor, true)
    whole.set(central, centralCursor)
    localCursor += piece.local.length
    centralCursor += central.length
  }
  const end = originalEnd.slice()
  const view = recordView(end)
  view.setUint16(8, pieces.length, true)
  view.setUint16(10, pieces.length, true)
  view.setUint32(12, centralLength, true)
  view.setUint32(16, localLength, true)
  whole.set(end, centralCursor)
  return whole
}

export async function carryPackage(original: Uint8Array, parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const file = new Uint8Array(original.buffer, original.byteOffset, original.byteLength)
  const records = await readContainer(file)
  const names = new Set(records.map((record) => record.name))
  if (names.size !== records.length) throw new ContainerError("duplicate")
  const opened = await readParts(file)
  const pieces: Piece[] = []
  for (const record of records) {
    if (record.directory) {
      pieces.push({ local: record.local, central: record.central })
      continue
    }
    const next = parts.get(record.name)
    if (next === undefined) continue
    const before = opened.get(record.name)
    if (before !== undefined && sameBytes(before, next)) {
      pieces.push({ local: record.local, central: record.central })
    } else {
      pieces.push(await changedPiece(record, next))
    }
  }
  const added = [...parts.keys()].filter((name) => !names.has(name)).sort()
  for (const name of added) {
    const data = parts.get(name)
    if (data === undefined) throw new Error(name)
    pieces.push(await addedPiece(name, data))
  }
  return assembled(pieces, file.subarray(file.length - endSize))
}

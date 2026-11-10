import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import {
  centralSignature,
  centralSize,
  ContainerError,
  deflate,
  descriptorFlag,
  endSize,
  localSignature,
  localSize,
  most16,
  most32,
  onlyBundledCompressor,
  readContainer,
  readParts,
  recordView,
  stored,
  utf8Flag,
  type ContainerRecord,
} from "./package-container.js"

export class CompressorError extends Error {
  constructor() {
    super("compressor")
    this.name = "CompressorError"
  }
}

const centralShift = 2
const packLevel = 6
const madeByVersion = 20
const fixedDate = 0x21

type Piece = { readonly local: Uint8Array; readonly central: Uint8Array }

type Pack = { readonly stream: Uint8Array; readonly crc: number; readonly size: number; readonly method: number }

async function packPart(data: Uint8Array, method: number): Promise<Pack> {
  configure(onlyBundledCompressor)
  let zipped: Uint8Array
  try {
    const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter(), {
      level: method === stored ? 0 : packLevel,
      useWebWorkers: false,
      useCompressionStream: false,
      dataDescriptor: false,
      zip64: false,
      extendedTimestamp: false,
    })
    await writer.add("p", new Uint8ArrayReader(data))
    zipped = await writer.close()
  } catch {
    throw new CompressorError()
  }
  const view = recordView(zipped)
  if (view.getUint16(8, true) !== method) throw new CompressorError()
  const compressed = view.getUint32(18, true)
  const start = localSize + view.getUint16(26, true) + view.getUint16(28, true)
  return {
    stream: zipped.slice(start, start + compressed),
    crc: view.getUint32(14, true),
    size: data.length,
    method,
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

async function changedPiece(original: ContainerRecord, data: Uint8Array): Promise<Piece> {
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
  const records = readContainer(file)
  const names = new Set(records.map((record) => record.name))
  const opened = await readParts(file)
  const pieces: Piece[] = []
  for (const record of records) {
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

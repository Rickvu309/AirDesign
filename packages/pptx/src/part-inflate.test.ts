import { configure, Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { crc32 } from "./crc32.js"
import { deflate, onlyBundledCompressor, readContainer } from "./package-container.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { inflate } from "./part-inflate.js"

type DeflateOptions = { level?: number; strategy?: number; finishFlush?: number }

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
  getBuiltinModule(name: "node:zlib"): {
    deflateRawSync(data: Uint8Array, options?: DeflateOptions): Uint8Array
    constants: Readonly<Record<string, number>>
  }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const zlib = process.getBuiltinModule("node:zlib")
const fixtureDir = `${process.cwd()}/scripts/pptx-fixtures`
const constant = (name: string) => zlib.constants[name] ?? 0
const deflateRawSync = (data: Uint8Array, options?: DeflateOptions) =>
  new Uint8Array(zlib.deflateRawSync(data, options))

function joined(pieces: readonly Uint8Array[]): Uint8Array {
  const whole = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0))
  let at = 0
  for (const piece of pieces) {
    whole.set(piece, at)
    at += piece.length
  }
  return whole
}

function zipped(stream: Uint8Array, size: number, crc: number): Uint8Array {
  const centralAt = 31 + stream.length
  const endAt = centralAt + 47
  const whole = new Uint8Array(endAt + 22)
  const view = new DataView(whole.buffer)
  for (const [at, shift] of [
    [0, 0],
    [centralAt, 2],
  ] as const) {
    view.setUint16(at + 4 + shift, 20, true)
    view.setUint16(at + 8 + shift, deflate, true)
    view.setUint32(at + 14 + shift, crc, true)
    view.setUint32(at + 18 + shift, stream.length, true)
    view.setUint32(at + 22 + shift, size, true)
    view.setUint16(at + 26 + shift, 1, true)
  }
  view.setUint32(0, 0x04034b50, true)
  whole[30] = 0x70
  whole.set(stream, 31)
  view.setUint32(centralAt, 0x02014b50, true)
  whole[centralAt + 46] = 0x70
  view.setUint32(endAt, 0x06054b50, true)
  view.setUint16(endAt + 8, 1, true)
  view.setUint16(endAt + 10, 1, true)
  view.setUint32(endAt + 12, 47, true)
  view.setUint32(endAt + 16, centralAt, true)
  return whole
}

async function zipJsInflate(stream: Uint8Array, size: number, crc: number): Promise<Uint8Array | undefined> {
  configure(onlyBundledCompressor)
  const reader = new ZipReader(new Uint8ArrayReader(zipped(stream, size, crc)), { useWebWorkers: false })
  try {
    const [entry] = await reader.getEntries()
    if (entry === undefined || entry.directory) return undefined
    return await entry.getData(new Uint8ArrayWriter())
  } catch {
    return undefined
  } finally {
    await reader.close()
  }
}

function accepted(data: Uint8Array | undefined, size: number, crc: number): Uint8Array | undefined {
  return data !== undefined && data.length === size && crc32(data) === crc ? data : undefined
}

async function sameAsZipJs(stream: Uint8Array, size: number, crc: number): Promise<void> {
  const before = accepted(await zipJsInflate(stream, size, crc), size, crc)
  const after = accepted(inflate(stream, size), size, crc)
  if (before === undefined || after === undefined) expect(after === undefined).toBe(before === undefined)
  else expect(sameBytes(after, before)).toBe(true)
}

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state
  }
}

function sample(next: () => number, size: number, alphabet: number): Uint8Array {
  const data = new Uint8Array(size)
  for (let at = 0; at < size; at += 1) {
    const reuse = at > 8 && next() % 4 === 0
    data[at] = reuse ? (data[at - 1 - (next() % Math.min(at, 300))] ?? 0) : next() % alphabet
  }
  return data
}

const strategies = ["Z_DEFAULT_STRATEGY", "Z_FILTERED", "Z_HUFFMAN_ONLY", "Z_RLE", "Z_FIXED"].map(constant)

describe("inflate", () => {
  it("gives every deflated corpus part the bytes the zip.js path gives", async () => {
    const decks = [
      ...readdirSync(fixtureDir).filter((name) => name.endsWith(".pptx")),
      ...readdirSync(`${fixtureDir}/corpus`).map((name) => `corpus/${name}`),
    ]
    let parts = 0
    for (const deck of decks) {
      for (const record of readContainer(readFileSync(`${fixtureDir}/${deck}`))) {
        if (record.method !== deflate) continue
        const before = await zipJsInflate(record.stream, record.size, record.crc)
        const after = inflate(record.stream, record.size)
        expect(before && after && sameBytes(after, before), `${deck} ${record.name}`).toBe(true)
        parts += 1
      }
    }
    expect(parts).toBeGreaterThan(2000)
  }, 60_000)

  it("matches zlib and the zip.js path on random data at every level and strategy", async () => {
    const next = seeded(7)
    for (let round = 0; round < 300; round += 1) {
      const size = round < 40 ? round : next() % (round % 10 === 0 ? 200_000 : 5_000)
      const data = sample(next, size, [2, 16, 256][round % 3] ?? 256)
      const stream = deflateRawSync(data, { level: round % 10, strategy: strategies[round % strategies.length] ?? 0 })
      const after = inflate(stream, size)
      expect(after !== undefined && sameBytes(after, data), `round ${round}`).toBe(true)
      if (round % 10 === 0) await sameAsZipJs(stream, size, crc32(data))
    }
  }, 60_000)

  it("reads streams whose blocks change kind mid-byte after a flush", async () => {
    const next = seeded(5)
    const flushes = ["Z_SYNC_FLUSH", "Z_FULL_FLUSH"].map(constant)
    for (let round = 0; round < 60; round += 1) {
      const chunks = Array.from({ length: 2 + (next() % 4) }, (_, index) =>
        sample(next, next() % 4_000, [2, 256][index % 2] ?? 256),
      )
      const streams = chunks.map((chunk, index) =>
        deflateRawSync(chunk, {
          level: next() % 10,
          strategy: strategies[next() % strategies.length] ?? 0,
          finishFlush: index === chunks.length - 1 ? constant("Z_FINISH") : (flushes[next() % flushes.length] ?? 0),
        }),
      )
      const whole = joined(streams)
      const data = joined(chunks)
      const after = inflate(whole, data.length)
      expect(after !== undefined && sameBytes(after, data), `round ${round}`).toBe(true)
      await sameAsZipJs(whole, data.length, crc32(data))
    }
  }, 60_000)

  it("refuses or accepts damaged streams exactly as the zip.js path does", async () => {
    const next = seeded(11)
    for (let round = 0; round < 400; round += 1) {
      const data = sample(next, 1 + (next() % 3_000), [4, 256][round % 2] ?? 256)
      const crc = crc32(data)
      const stream = deflateRawSync(data, { level: round % 10, strategy: strategies[round % 5] ?? 0 })
      const damaged = stream.slice()
      const flips = 1 + (next() % 3)
      for (let flip = 0; flip < flips; flip += 1) {
        const at = next() % damaged.length
        damaged[at] = (damaged[at] ?? 0) ^ (1 << (next() % 8))
      }
      await sameAsZipJs(damaged, data.length, crc)
      await sameAsZipJs(stream.subarray(0, next() % stream.length), data.length, crc)
    }
  }, 120_000)

  it("refuses random bytes as the zip.js path does", async () => {
    const next = seeded(13)
    for (let round = 0; round < 300; round += 1) {
      const stream = new Uint8Array(1 + (next() % 64)).map(() => next() & 0xff)
      const size = next() % 64
      const data = inflate(stream, size)
      await sameAsZipJs(stream, size, data === undefined ? 0 : crc32(data))
    }
  }, 60_000)

  it("treats bytes after the final block and a missing final block as the zip.js path does", async () => {
    const data = encodeUtf8("<p:sld>".repeat(200))
    const stream = deflateRawSync(data)
    const crc = crc32(data)
    const unfinished = deflateRawSync(data, { finishFlush: constant("Z_SYNC_FLUSH") })
    for (const variant of [
      new Uint8Array([...stream, 0]),
      new Uint8Array([...stream, 1, 2, 3, 4]),
      unfinished,
      stream.subarray(0, stream.length - 1),
      new Uint8Array(),
      new Uint8Array([3, 0]),
    ]) {
      await sameAsZipJs(variant, data.length, crc)
    }
    await sameAsZipJs(new Uint8Array([3, 0]), 0, 0)
    await sameAsZipJs(new Uint8Array([1, 0, 0, 0xff, 0xff]), 0, 0)
  })

  it("refuses a size the stream does not fill or overruns", () => {
    const data = encodeUtf8("abcabcabc")
    const stream = deflateRawSync(data)
    expect(inflate(stream, data.length)).toEqual(data)
    expect(inflate(stream, data.length - 1)).toBeUndefined()
    expect(inflate(stream, data.length + 1)).toBeUndefined()
  })
})

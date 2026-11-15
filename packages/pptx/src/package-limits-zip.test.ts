import { ZipReader } from "@zip.js/zip.js"
import { describe, expect, it, vi } from "vitest"
import { crc32 } from "./crc32.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { readPackage, type ReadPackage } from "./package-limits.js"
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

const zipOnly = vi.hoisted(() => ({ on: false }))

vi.mock("./package-container.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./package-container.js")>()
  return {
    ...original,
    plainContainer: (file: Uint8Array) => (zipOnly.on ? undefined : original.plainContainer(file)),
  }
})

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const zlib = process.getBuiltinModule("node:zlib")
const fixtureDir = `${process.cwd()}/scripts/pptx-fixtures`
const constant = (name: string) => zlib.constants[name] ?? 0
const deflateRawSync = (data: Uint8Array, options?: DeflateOptions) =>
  new Uint8Array(zlib.deflateRawSync(data, options))
const strategies = ["Z_DEFAULT_STRATEGY", "Z_FILTERED", "Z_HUFFMAN_ONLY", "Z_RLE", "Z_FIXED"].map(constant)
const entriesRead = vi.spyOn(ZipReader.prototype, "getEntries")

type Path = "plain" | "zip.js"

type Outcome = { readonly ok: true; readonly names: readonly string[] } | Exclude<ReadPackage, { readonly ok: true }>

function outcome(read: ReadPackage): Outcome {
  return read.ok ? { ok: true, names: [...read.parts.keys()] } : read
}

async function sameBothWays(file: Uint8Array, label: string): Promise<{ read: ReadPackage; path: Path }> {
  const kept = file.slice()
  const calls = entriesRead.mock.calls.length
  const after = await readPackage(file)
  expect(sameBytes(file, kept), label).toBe(true)
  if (entriesRead.mock.calls.length !== calls) return { read: after, path: "zip.js" }
  zipOnly.on = true
  const before = await readPackage(file)
  zipOnly.on = false
  expect(outcome(after), label).toEqual(outcome(before))
  if (before.ok && after.ok) {
    for (const [name, data] of before.parts) {
      expect(sameBytes(after.parts.get(name) ?? new Uint8Array(), data), `${label} ${name}`).toBe(true)
    }
  }
  return { read: after, path: "plain" }
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff)
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function joined(pieces: readonly Uint8Array[]): Uint8Array {
  const whole = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0))
  let at = 0
  for (const piece of pieces) {
    whole.set(piece, at)
    at += piece.length
  }
  return whole
}

function field(id: number, data: Uint8Array): Uint8Array {
  return joined([u16(id), u16(data.length), data])
}

type Member = {
  readonly name: string | Uint8Array
  readonly data: Uint8Array
  readonly method?: number
  readonly stream?: Uint8Array
  readonly crc?: number
  readonly size?: number
  readonly flags?: number
  readonly localFlags?: number
  readonly localMethod?: number
  readonly localNumbers?: readonly [crc: number, packed: number, size: number]
  readonly localExtra?: Uint8Array
  readonly centralExtra?: Uint8Array
  readonly external?: number
  readonly madeBy?: number
  readonly descriptor?: Uint8Array
}

type Layout = {
  readonly before?: Uint8Array
  readonly after?: Uint8Array
  readonly comment?: Uint8Array
  readonly localOrder?: readonly number[]
}

function packed(members: readonly Member[], layout: Layout = {}): Uint8Array {
  const shaped = members.map((member) => {
    const method = member.method ?? 8
    const stream = member.stream ?? (method === 0 ? member.data : deflateRawSync(member.data))
    const crc = member.crc ?? crc32(member.data)
    const size = member.size ?? member.data.length
    const name = typeof member.name === "string" ? encodeUtf8(member.name) : member.name
    const flags = member.flags ?? 0
    const [localCrc, localPacked, localSize] = member.localNumbers ?? [crc, stream.length, size]
    const local = joined([
      u32(0x04034b50),
      u16(20),
      u16(member.localFlags ?? flags),
      u16(member.localMethod ?? method),
      u32(0x00210000),
      u32(localCrc),
      u32(localPacked),
      u32(localSize),
      u16(name.length),
      u16(member.localExtra?.length ?? 0),
      name,
      member.localExtra ?? new Uint8Array(),
      stream,
      member.descriptor ?? new Uint8Array(),
    ])
    return { member, method, stream, crc, size, name, flags, local }
  })
  const order = layout.localOrder ?? shaped.map((_, index) => index)
  const offsets = new Map<number, number>()
  let cursor = 0
  for (const index of order) {
    offsets.set(index, cursor)
    cursor += shaped[index]?.local.length ?? 0
  }
  const locals = order.map((index) => shaped[index]?.local ?? new Uint8Array())
  const central = joined(
    shaped.map((row, index) =>
      joined([
        u32(0x02014b50),
        u16(row.member.madeBy ?? 20),
        u16(20),
        u16(row.flags),
        u16(row.method),
        u32(0x00210000),
        u32(row.crc),
        u32(row.stream.length),
        u32(row.size),
        u16(row.name.length),
        u16(row.member.centralExtra?.length ?? 0),
        u16(0),
        u16(0),
        u16(0),
        u32(row.member.external ?? 0),
        u32(offsets.get(index) ?? 0),
        row.name,
        row.member.centralExtra ?? new Uint8Array(),
      ]),
    ),
  )
  const comment = layout.comment ?? new Uint8Array()
  const end = joined([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(members.length),
    u16(members.length),
    u32(central.length),
    u32(cursor),
    u16(comment.length),
    comment,
  ])
  return joined([layout.before ?? new Uint8Array(), ...locals, central, end, layout.after ?? new Uint8Array()])
}

const types = encodeUtf8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
const presentation = encodeUtf8("<p:presentation/>")
const slide = encodeUtf8(`<p:sld>${"<p:sp><p:txBody>Plain words</p:txBody></p:sp>".repeat(40)}</p:sld>`)
const picture = Uint8Array.from({ length: 900 }, (_, at) => (at * 37) & 0xff)

function deck(extra: readonly Member[] = [], changed: Partial<Member> = {}): readonly Member[] {
  return [
    { name: "[Content_Types].xml", data: types },
    { name: "ppt/presentation.xml", data: presentation },
    { name: "ppt/slides/slide1.xml", data: slide, ...changed },
    { name: "ppt/media/image1.png", data: picture, method: 0 },
    ...extra,
  ]
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

function withStream(stream: Uint8Array, size: number, crc: number): Uint8Array {
  return packed([
    { name: "[Content_Types].xml", data: types, method: 0 },
    { name: "ppt/presentation.xml", data: presentation, method: 0 },
    { name: "ppt/media/part.bin", data: new Uint8Array(), stream, size, crc },
  ])
}

function withSecondEnd(): Uint8Array {
  const shell = (end: Uint8Array) => packed(deck([{ name: "ppt/media/end.bin", data: end, method: 0 }]))
  const draft = shell(new Uint8Array(22))
  const view = new DataView(draft.buffer)
  const centralLength = view.getUint32(draft.length - 10, true)
  const centralAt = view.getUint32(draft.length - 6, true)
  return shell(
    joined([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(5),
      u16(5),
      u32(centralLength),
      u32(centralAt),
      u16(draft.length - centralAt),
    ]),
  )
}

describe("readPackage", () => {
  it("reads every corpus deck and PowerPoint case without zip.js, to the bytes zip.js gives", async () => {
    const decks = [
      ...readdirSync(fixtureDir).filter((name) => name.endsWith(".pptx")),
      ...readdirSync(`${fixtureDir}/corpus`).map((name) => `corpus/${name}`),
    ]
    let parts = 0
    for (const deck of decks) {
      const { read, path } = await sameBothWays(new Uint8Array(readFileSync(`${fixtureDir}/${deck}`)), deck)
      expect([deck, path, read.ok]).toEqual([deck, "plain", true])
      parts += read.ok ? read.parts.size : 0
    }
    expect(parts).toBeGreaterThan(3000)
  }, 120_000)

  const containers: readonly (readonly [string, Path, Uint8Array])[] = [
    ["a deck of deflated and stored parts", "plain", packed(deck())],
    [
      "Office's growth hint in a local header",
      "plain",
      packed(deck([], { localExtra: field(0xa220, new Uint8Array(6)) })),
    ],
    [
      "a signed data descriptor",
      "plain",
      packed(
        deck([], {
          flags: 8,
          localNumbers: [0, 0, 0],
          descriptor: joined([
            u32(0x08074b50),
            u32(crc32(slide)),
            u32(deflateRawSync(slide).length),
            u32(slide.length),
          ]),
        }),
      ),
    ],
    [
      "an unsigned data descriptor",
      "plain",
      packed(
        deck([], {
          flags: 8,
          localNumbers: [0, 0, 0],
          descriptor: joined([u32(crc32(slide)), u32(deflateRawSync(slide).length), u32(slide.length)]),
        }),
      ),
    ],
    ["a backslash inside a name", "plain", packed(deck([{ name: "ppt\\media\\image2.png", data: picture }]))],
    [
      "a data descriptor that disagrees with the directory",
      "zip.js",
      packed(
        deck([], {
          flags: 8,
          localNumbers: [0, 0, 0],
          descriptor: joined([
            u32(0x08074b50),
            u32(crc32(slide) ^ 1),
            u32(deflateRawSync(slide).length),
            u32(slide.length),
          ]),
        }),
      ),
    ],
    ["a comment on the end record", "zip.js", packed(deck(), { comment: encodeUtf8("made elsewhere") })],
    ["bytes before the first part", "zip.js", packed(deck(), { before: encodeUtf8("stub") })],
    ["bytes after the end record", "zip.js", packed(deck(), { after: encodeUtf8("tail") })],
    ["a second end record inside a part that reaches the end of the file", "zip.js", withSecondEnd()],
    [
      "a zip64 field in the directory",
      "zip.js",
      packed(deck([], { centralExtra: field(0x0001, joined([u32(slide.length), u32(0)])) })),
    ],
    [
      "a unicode path that renames a part",
      "zip.js",
      packed(
        deck([], {
          name: "ppt/slides/slideX.xml",
          centralExtra: field(
            0x7075,
            joined([
              Uint8Array.of(1),
              u32(crc32(encodeUtf8("ppt/slides/slideX.xml"))),
              encodeUtf8("ppt/slides/slide1.xml"),
            ]),
          ),
        }),
      ),
    ],
    [
      "a timestamp field",
      "zip.js",
      packed(
        deck([], {
          localExtra: field(0x5455, Uint8Array.of(1, 0, 0, 0, 0)),
          centralExtra: field(0x5455, Uint8Array.of(1, 0, 0, 0, 0)),
        }),
      ),
    ],
    ["a short timestamp field", "zip.js", packed(deck([], { centralExtra: field(0x5455, new Uint8Array()) }))],
    [
      "an AES field on a part that is not encrypted",
      "zip.js",
      packed(deck([], { centralExtra: field(0x9901, Uint8Array.of(2, 0, 0x41, 0x45, 3, 8, 0)) })),
    ],
    ["a folder", "zip.js", packed(deck([{ name: "ppt/", data: new Uint8Array(), method: 0 }]))],
    [
      "a folder by its DOS attribute",
      "zip.js",
      packed(deck([{ name: "ppt/extra", data: new Uint8Array(), method: 0, external: 0x10 }])),
    ],
    [
      "a folder by its unix mode",
      "zip.js",
      packed(deck([{ name: "ppt/extra", data: new Uint8Array(), method: 0, madeBy: 0x0314, external: 0x41ed << 16 }])),
    ],
    ["a name that climbs out of the folder", "zip.js", packed(deck([{ name: "ppt/../x.xml", data: types }]))],
    ["a name that starts at the root", "zip.js", packed(deck([{ name: "/ppt/x.xml", data: types }]))],
    ["a name that starts with a backslash", "zip.js", packed(deck([{ name: "\\ppt\\x.xml", data: types }]))],
    ["a name with a drive letter", "zip.js", packed(deck([{ name: "C:ppt/x.xml", data: types }]))],
    ["a UTF-8 name", "zip.js", packed(deck([{ name: "ppt/média/x.png", data: picture, flags: 0x800 }]))],
    [
      "a name in the DOS code page",
      "zip.js",
      packed(deck([{ name: Uint8Array.of(0x61, 0x82, 0x2e, 0x62), data: picture }])),
    ],
    ["a control character in a name", "zip.js", packed(deck([{ name: "ppt/media/\u0001.png", data: picture }]))],
    ["a delete character in a name", "zip.js", packed(deck([{ name: "ppt/media/\u007f.png", data: picture }]))],
    ["names that differ only in case", "zip.js", packed(deck([{ name: "PPT/presentation.xml", data: presentation }]))],
    ["the same name twice", "zip.js", packed(deck([{ name: "ppt/presentation.xml", data: types }]))],
    ["parts stored out of order", "zip.js", packed(deck(), { localOrder: [1, 0, 2, 3] })],
    ["local flags that disagree with the directory", "zip.js", packed(deck([], { localFlags: 0x800 }))],
    ["a local method that disagrees with the directory", "zip.js", packed(deck([], { localMethod: 0 }))],
    [
      "local sizes that disagree with the directory",
      "zip.js",
      packed(deck([], { localNumbers: [crc32(slide), 1, slide.length] })),
    ],
    [
      "a stored part whose size disagrees with its bytes",
      "zip.js",
      packed(deck([{ name: "ppt/media/image2.png", data: picture, method: 0, size: picture.length + 1 }])),
    ],
    ["a deflated part with a wrong checksum", "zip.js", packed(deck([], { crc: crc32(slide) ^ 1 }))],
    [
      "a stored part with a wrong checksum",
      "zip.js",
      packed(deck([{ name: "ppt/media/image2.png", data: picture, method: 0, crc: 1 }])),
    ],
    ["a deflate64 part", "zip.js", packed(deck([], { method: 9 }))],
    ["an encrypted part", "zip.js", packed(deck([], { flags: 1 }))],
    ["no parts", "zip.js", packed([])],
  ]

  it.each(containers)("reads %s as zip.js does, through the %s path", async (label, path, file) => {
    expect((await sameBothWays(file, label)).path).toBe(path)
  })

  it("reads damaged, cut and noisy part streams as zip.js does", async () => {
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
      await sameBothWays(withStream(damaged, data.length, crc), `damaged ${round}`)
      await sameBothWays(withStream(stream.subarray(0, next() % stream.length), data.length, crc), `cut ${round}`)
    }
    const noise = seeded(13)
    for (let round = 0; round < 300; round += 1) {
      const stream = new Uint8Array(1 + (noise() % 64)).map(() => noise() & 0xff)
      const size = noise() % 64
      const data = inflate(stream, size)
      await sameBothWays(withStream(stream, size, data === undefined ? 0 : crc32(data)), `noise ${round}`)
    }
    const whole = encodeUtf8("<p:sld>".repeat(200))
    const finished = deflateRawSync(whole)
    for (const variant of [
      finished,
      joined([finished, Uint8Array.of(0)]),
      joined([finished, Uint8Array.of(1, 2, 3, 4)]),
      deflateRawSync(whole, { finishFlush: constant("Z_SYNC_FLUSH") }),
      finished.subarray(0, finished.length - 1),
      new Uint8Array(),
      Uint8Array.of(3, 0),
    ]) {
      await sameBothWays(withStream(variant, whole.length, crc32(whole)), `ending ${variant.length}`)
    }
  }, 120_000)

  it("reads a PowerPoint case with flipped bits, cut short or replaced by noise as zip.js does", async () => {
    const original = new Uint8Array(readFileSync(`${fixtureDir}/text.pptx`))
    const next = seeded(17)
    for (let round = 0; round < 150; round += 1) {
      const damaged = original.slice()
      const flips = 1 + (next() % 3)
      for (let flip = 0; flip < flips; flip += 1) {
        const at = next() % damaged.length
        damaged[at] = (damaged[at] ?? 0) ^ (1 << (next() % 8))
      }
      await sameBothWays(damaged, `flipped ${round}`)
    }
    for (let round = 0; round < 50; round += 1) {
      await sameBothWays(original.subarray(0, next() % original.length), `cut ${round}`)
      await sameBothWays(
        new Uint8Array(1 + (next() % 2_000)).map(() => next() & 0xff),
        `noise ${round}`,
      )
    }
  }, 120_000)
})

import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter, type ZipWriterAddDataOptions } from "@zip.js/zip.js"
import { beforeAll, describe, expect, it } from "vitest"
import { prepareMarkup } from "./element-span.js"
import { exportPackage } from "./export-package.js"
import { carryPackage } from "./package-carry.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { ContainerError, readParts, type ContainerKind } from "./package-container.js"
import { readPackage } from "./package-limits.js"
import { readShapes } from "./read-shapes.js"
import { applyRoute } from "./slide-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
  getBuiltinModule(name: "node:module"): { createRequire(path: string): { resolve(id: string): string } }
  getBuiltinModule(name: "node:zlib"): { crc32(data: Uint8Array): number }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const { createRequire } = process.getBuiltinModule("node:module")
const { crc32 } = process.getBuiltinModule("node:zlib")
const fixtureDir = `${process.cwd()}/scripts/pptx-fixtures`
const fixture = (name: string) => readFileSync(`${fixtureDir}/${name}`)
const fixtureDecks = readdirSync(fixtureDir).filter((name) => name.endsWith(".pptx"))

beforeAll(async () => {
  const require = createRequire(`${process.cwd()}/packages/pptx/package.json`)
  await prepareMarkup(readFileSync(require.resolve("sax-wasm/lib/sax-wasm.wasm")))
})

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

type Located = { readonly name: string; readonly local: Uint8Array }

function localRecords(file: Uint8Array): readonly Located[] {
  const data = view(file)
  const endAt = file.length - 22
  const count = data.getUint16(endAt + 10, true)
  const centralAt = data.getUint32(endAt + 16, true)
  const rows: { name: string; offset: number }[] = []
  let cursor = centralAt
  for (let index = 0; index < count; index += 1) {
    const nameLength = data.getUint16(cursor + 28, true)
    const extraLength = data.getUint16(cursor + 30, true)
    const commentLength = data.getUint16(cursor + 32, true)
    const name = String.fromCharCode(...file.subarray(cursor + 46, cursor + 46 + nameLength))
    rows.push({ name, offset: data.getUint32(cursor + 42, true) })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return rows.map((row, index) => ({
    name: row.name,
    local: file.subarray(row.offset, rows[index + 1]?.offset ?? centralAt),
  }))
}

function firstTextEdit(parts: ReadonlyMap<string, Uint8Array>): {
  part: string
  edited: ReadonlyMap<string, Uint8Array>
} {
  for (const shape of readShapes(parts)) {
    if (shape.kind !== "p:sp" || !shape.text) continue
    try {
      return {
        part: shape.part,
        edited: applyRoute(parts, { name: "text", part: shape.part, shape: shape.shape, text: "Carried" }),
      }
    } catch {
      continue
    }
  }
  throw new Error("text shape")
}

describe("exportPackage with no edit", () => {
  it.each(fixtureDecks)(
    "gives back %s byte for byte",
    async (name) => {
      const original = fixture(name)
      const parts = await readParts(original)
      expect(sameBytes(await exportPackage(original, parts), original)).toBe(true)
    },
    60_000,
  )
})

describe("exportPackage after one text edit", () => {
  it.each(["nasa-1d-cnn.pptx", "doe-heat-pumps.pptx", "census-updating-spm.pptx"])(
    "%s exports the same bytes twice and copies every untouched record",
    async (name) => {
      const original = fixture(name)
      const parts = await readParts(original)
      const { part, edited } = firstTextEdit(parts)
      const once = await exportPackage(original, edited)
      const twice = await exportPackage(original, edited)
      expect(sameBytes(once, twice)).toBe(true)
      const before = new Map(localRecords(original).map((record) => [record.name, record.local]))
      const after = localRecords(once)
      expect(after.map((record) => record.name)).toEqual([...before.keys()])
      for (const record of after) {
        if (record.name === part) continue
        expect(sameBytes(record.local, before.get(record.name) ?? new Uint8Array())).toBe(true)
      }
      const touched = after.find((record) => record.name === part)
      expect(sameBytes(touched?.local ?? new Uint8Array(), before.get(part) ?? new Uint8Array())).toBe(false)
    },
    60_000,
  )
})

describe("carryPackage part changes on clean.pptx", () => {
  const name = "ppt/slides/slide1.xml"

  async function checked(
    original: Uint8Array,
    parts: ReadonlyMap<string, Uint8Array>,
  ): Promise<{ first: Uint8Array; back: ReadonlyMap<string, Uint8Array> }> {
    const first = await exportPackage(original, parts)
    const second = await exportPackage(original, parts)
    expect(sameBytes(first, second)).toBe(true)
    const read = await readPackage(first)
    if (!read.ok) throw new Error(read.reason)
    return { first, back: read.parts }
  }

  it("rewrites a changed part in place", async () => {
    const original = fixture("clean.pptx")
    const parts = new Map(await readParts(original))
    const next = applyRoute(parts, { name: "text", part: name, shape: "2", text: "Changed text" })
    const { first, back } = await checked(original, next)
    expect(back.get(name)).toEqual(next.get(name))
    expect(localRecords(first).map((record) => record.name)).toEqual(
      localRecords(original).map((record) => record.name),
    )
  })

  it("adds a new part after the last original entry in sorted order", async () => {
    const original = fixture("clean.pptx")
    const parts = new Map(await readParts(original))
    parts.set("ppt/media/zz.bin", Uint8Array.from([1, 2, 3]))
    parts.set("ppt/media/aa.bin", Uint8Array.from([4, 5, 6]))
    const { first, back } = await checked(original, parts)
    expect(back.get("ppt/media/zz.bin")).toEqual(Uint8Array.from([1, 2, 3]))
    expect(back.get("ppt/media/aa.bin")).toEqual(Uint8Array.from([4, 5, 6]))
    const names = localRecords(first).map((record) => record.name)
    expect(names.slice(-2)).toEqual(["ppt/media/aa.bin", "ppt/media/zz.bin"])
    expect(names.slice(0, -2)).toEqual(localRecords(original).map((record) => record.name))
  })

  it("drops a removed part's records", async () => {
    const original = fixture("clean.pptx")
    const parts = new Map(await readParts(original))
    const removed = "docProps/app.xml"
    expect(parts.has(removed)).toBe(true)
    parts.delete(removed)
    const { first, back } = await checked(original, parts)
    expect(back.has(removed)).toBe(false)
    expect(localRecords(first).map((record) => record.name)).not.toContain(removed)
  })
})

async function tinyZip(options: ZipWriterAddDataOptions = {}, comment?: Uint8Array): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter(), {
    level: 0,
    useWebWorkers: false,
    dataDescriptor: false,
    extendedTimestamp: false,
  })
  await writer.add("a", new Uint8ArrayReader(encodeUtf8("one")), options)
  await writer.add("b", new Uint8ArrayReader(encodeUtf8("two")), options)
  return comment === undefined ? writer.close() : writer.close(comment)
}

function endOf(file: Uint8Array): number {
  return file.length - 22
}

function centralAt(file: Uint8Array): number {
  return view(file).getUint32(endOf(file) + 16, true)
}

function planted(file: Uint8Array, at: number, junk: Uint8Array = encodeUtf8("JUNK")): Uint8Array {
  const result = new Uint8Array(file.length + junk.length)
  result.set(file.subarray(0, at), 0)
  result.set(junk, at)
  result.set(file.subarray(at), at + junk.length)
  const oldEnd = endOf(file)
  const oldCentral = centralAt(file)
  const old = view(file)
  const data = view(result)
  const shiftOf = (position: number) => (position >= at ? junk.length : 0)
  const count = old.getUint16(oldEnd + 10, true)
  let cursor = oldCentral
  for (let index = 0; index < count; index += 1) {
    const offset = old.getUint32(cursor + 42, true)
    data.setUint32(cursor + shiftOf(cursor) + 42, offset + shiftOf(offset), true)
    cursor += 46 + old.getUint16(cursor + 28, true) + old.getUint16(cursor + 30, true)
  }
  if (at <= oldEnd) {
    const newEnd = oldEnd + junk.length
    data.setUint32(newEnd + 16, oldCentral + shiftOf(oldCentral), true)
    if (at > oldCentral) data.setUint32(newEnd + 12, old.getUint32(oldEnd + 12, true) + junk.length, true)
  }
  return result
}

function withGap(file: Uint8Array): Uint8Array {
  const at = view(file).getUint32(centralAt(file) + 46 + 1 + 42, true)
  const shifted = new Uint8Array(file.length + 1)
  shifted.set(file.subarray(0, at), 0)
  shifted.set(file.subarray(at), at + 1)
  const data = view(shifted)
  data.setUint32(centralAt(file) + 1 + 46 + 1 + 42, at + 1, true)
  data.setUint32(shifted.length - 22 + 16, centralAt(file) + 1, true)
  return shifted
}

function reversedCentral(file: Uint8Array): Uint8Array {
  const at = centralAt(file)
  const firstLength = 46 + 1
  const second = file.slice(at + firstLength, endOf(file))
  const first = file.slice(at, at + firstLength)
  const swapped = file.slice()
  swapped.set(second, at)
  swapped.set(first, at + second.length)
  return swapped
}

function withMethod(file: Uint8Array, method: number): Uint8Array {
  const changed = file.slice()
  view(changed).setUint16(8, method, true)
  view(changed).setUint16(centralAt(file) + 10, method, true)
  return changed
}

function withDisk(file: Uint8Array): Uint8Array {
  const changed = file.slice()
  view(changed).setUint16(endOf(file) + 4, 1, true)
  return changed
}

function withTrailing(file: Uint8Array): Uint8Array {
  const longer = new Uint8Array(file.length + 3)
  longer.set(file, 0)
  return longer
}

describe("carryPackage refuses a container it cannot reproduce", () => {
  const rejects = async (file: Uint8Array, kind: ContainerKind) => {
    const failure = await carryPackage(file, new Map()).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ContainerError)
    expect((failure as ContainerError).kind).toBe(kind)
  }

  const secondLocal = (file: Uint8Array) => view(file).getUint32(centralAt(file) + 47 + 42, true)

  it.each([
    ["before the first entry", () => 0],
    ["between two entries", secondLocal],
    ["after the last entry's data", centralAt],
    ["between the central records and the end record", endOf],
    ["after the end record", (file: Uint8Array) => file.length],
  ] as const)("bytes no record explains %s", async (_where, position) => {
    const file = await tinyZip()
    await rejects(planted(file, position(file)), "unaccounted")
  })

  it("bytes between two central records", async () => {
    const file = await tinyZip()
    await rejects(planted(file, centralAt(file) + 47), "unreadable")
  })

  it("twelve bytes before the end record of clean.pptx", async () => {
    const original = new Uint8Array(fixture("clean.pptx"))
    await rejects(planted(original, endOf(original), encodeUtf8("JUNKJUNKJUNK")), "unaccounted")
  })

  it("a digital signature record before the end record", async () => {
    const original = new Uint8Array(fixture("clean.pptx"))
    const record = Uint8Array.from([0x50, 0x4b, 0x05, 0x05, 4, 0, 0x73, 0x69, 0x67, 0x6e])
    await rejects(planted(original, endOf(original), record), "unaccounted")
  })

  it("an end record on another disk that the reader accepts", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint16(endOf(file) + 8, 1, true)
    await rejects(file, "disk")
  })

  it("an end record whose central size does not reach it", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint32(endOf(file) + 12, view(file).getUint32(endOf(file) + 12, true) - 1, true)
    await rejects(file, "unaccounted")
  })

  it("an end record with start disk 1", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint16(endOf(file) + 6, 1, true)
    await rejects(file, "disk")
  })

  it("a central record on another disk", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint16(centralAt(file) + 34, 1, true)
    await rejects(file, "disk")
  })

  it("an end record whose comment length runs past the file", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint16(endOf(file) + 20, 5, true)
    await rejects(file, "unaccounted")
  })

  it("a central field of 0xffffffff", async () => {
    const file = (await tinyZip()).slice()
    view(file).setUint32(centralAt(file) + 24, 0xffffffff, true)
    await rejects(file, "zip64")
  })

  it("a data descriptor that does not match the central record", async () => {
    const file = (await tinyZip({ dataDescriptor: true, dataDescriptorSignature: false })).slice()
    const data = view(file)
    const descriptor = 30 + 1 + data.getUint32(centralAt(file) + 20, true)
    data.setUint32(descriptor, data.getUint32(descriptor, true) ^ 1, true)
    await rejects(file, "unaccounted")
  })

  it("a local name that differs from the central name", async () => {
    const file = (await tinyZip()).slice()
    file[30] = 0x7a
    await rejects(file, "unreadable")
  })

  it("zip64", async () => rejects(await tinyZip({ zip64: true }), "zip64"))
  it("a file comment", async () => rejects(await tinyZip({}, Uint8Array.from([7])), "comment"))
  it("an entry comment", async () => rejects(await tinyZip({ comment: "note" }), "comment"))
  it("a gap between entries", async () => rejects(withGap(await tinyZip()), "unaccounted"))
  it("central order that differs from local order", async () => rejects(reversedCentral(await tinyZip()), "order"))
  it("several disks", async () => rejects(withDisk(await tinyZip()), "disk"))
  it("a method other than stored or deflate", async () => rejects(withMethod(await tinyZip(), 12), "method"))
  it("trailing bytes", async () => rejects(withTrailing(await tinyZip()), "unaccounted"))
  it("a duplicate name", async () => {
    const file = await tinyZip()
    const copy = file.slice()
    const at = centralAt(file)
    copy[at + 46] = 0x61
    copy[at + 46 + 47] = 0x61
    copy[30] = 0x61
    copy[view(file).getUint32(at + 47 + 42, true) + 30] = 0x61
    await rejects(copy, "duplicate")
  })
})

describe("carryPackage header fields", () => {
  const changedOf = (name: string, next: Uint8Array, source: ReadonlyMap<string, Uint8Array>) =>
    new Map(source).set(name, next)

  function centralOf(file: Uint8Array, index: number): number {
    const data = view(file)
    let cursor = centralAt(file)
    for (let row = 0; row < index; row += 1) {
      cursor += 46 + data.getUint16(cursor + 28, true) + data.getUint16(cursor + 30, true)
    }
    return cursor
  }

  it("dates an added part 1980-01-01 at midnight in both headers", async () => {
    const original = new Uint8Array(fixture("clean.pptx"))
    const parts = new Map(await readParts(original)).set("ppt/media/new.bin", Uint8Array.from([1, 2, 3]))
    const written = await carryPackage(original, parts)
    const last = localRecords(written).at(-1)
    if (last === undefined) throw new Error("record")
    expect(last.name).toBe("ppt/media/new.bin")
    expect(view(last.local).getUint16(10, true)).toBe(0)
    expect(view(last.local).getUint16(12, true)).toBe(0x21)
    const central = centralOf(written, parts.size - 1)
    expect(view(written).getUint16(central + 12, true)).toBe(0)
    expect(view(written).getUint16(central + 14, true)).toBe(0x21)
  })

  it("writes the CRC of a changed part and an added part in both headers", async () => {
    const original = new Uint8Array(fixture("clean.pptx"))
    const changed = encodeUtf8("<p:sld>changed</p:sld>")
    const added = Uint8Array.from([7, 8, 9])
    const parts = new Map(await readParts(original))
      .set("ppt/slides/slide1.xml", changed)
      .set("ppt/media/new.bin", added)
    const written = await carryPackage(original, parts)
    const records = localRecords(written)
    const data = view(written)
    for (const [name, bytes] of [
      ["ppt/slides/slide1.xml", changed],
      ["ppt/media/new.bin", added],
    ] as const) {
      const index = records.findIndex((record) => record.name === name)
      const record = records[index]
      if (record === undefined) throw new Error(name)
      expect(view(record.local).getUint32(14, true)).toBe(crc32(bytes))
      expect(data.getUint32(centralOf(written, index) + 16, true)).toBe(crc32(bytes))
    }
  })

  it("corrects the end record's entries on this disk and central size", async () => {
    const original = new Uint8Array(fixture("clean.pptx"))
    const parts = new Map(await readParts(original)).set("ppt/media/new.bin", Uint8Array.from([1]))
    const written = await carryPackage(original, parts)
    const end = endOf(written)
    expect(view(written).getUint16(end + 8, true)).toBe(parts.size)
    expect(view(written).getUint32(end + 12, true)).toBe(end - centralAt(written))
  })

  it("drops the descriptor of a changed part and writes its sizes in the local header", async () => {
    const original = await tinyZip({ dataDescriptor: true })
    const next = encodeUtf8("changed text")
    const written = await carryPackage(original, changedOf("a", next, await readParts(original)))
    const data = view(written)
    expect(data.getUint16(6, true) & 8).toBe(0)
    expect(data.getUint32(22, true)).toBe(next.length)
    expect(data.getUint32(18, true)).toBe(next.length)
    expect(data.getUint16(centralAt(written) + 8, true) & 8).toBe(0)
    const records = localRecords(written)
    expect(records[0]?.local.length).toBe(30 + 1 + next.length)
    expect(await readParts(written)).toEqual(changedOf("a", next, await readParts(original)))
  })

  it("keeps a changed stored part stored", async () => {
    const original = await tinyZip()
    const next = encodeUtf8("stored text")
    const written = await carryPackage(original, changedOf("a", next, await readParts(original)))
    const data = view(written)
    expect(data.getUint16(8, true)).toBe(0)
    expect(data.getUint16(centralAt(written) + 10, true)).toBe(0)
    expect(data.getUint32(18, true)).toBe(next.length)
    expect(Array.from(written.subarray(30 + 1, 30 + 1 + next.length))).toEqual(Array.from(next))
  })

  it.each([
    ["a 12-byte", false],
    ["a 16-byte", true],
  ] as const)("copies %s data descriptor", async (_name, signature) => {
    const original = await tinyZip({ dataDescriptor: true, dataDescriptorSignature: signature })
    const written = await carryPackage(original, await readParts(original))
    expect(sameBytes(written, original)).toBe(true)
  })
})

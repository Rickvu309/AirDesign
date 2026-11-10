import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter, type ZipWriterAddDataOptions } from "@zip.js/zip.js"
import { beforeAll, describe, expect, it } from "vitest"
import { prepareMarkup } from "./element-span.js"
import { exportPackage } from "./export-package.js"
import { ContainerError, carryPackage, type ContainerKind } from "./package-carry.js"
import { encodeUtf8, readParts, sameBytes } from "./package-bytes.js"
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
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const { createRequire } = process.getBuiltinModule("node:module")
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

  it("zip64", async () => rejects(await tinyZip({ zip64: true }), "zip64"))
  it("a file comment", async () => rejects(await tinyZip({}, Uint8Array.from([7])), "comment"))
  it("an entry comment", async () => rejects(await tinyZip({ comment: "note" }), "comment"))
  it("a gap between entries", async () => rejects(withGap(await tinyZip()), "gap"))
  it("central order that differs from local order", async () => rejects(reversedCentral(await tinyZip()), "order"))
  it("several disks", async () => rejects(withDisk(await tinyZip()), "disk"))
  it("a method other than stored or deflate", async () => rejects(withMethod(await tinyZip(), 12), "method"))
  it("trailing bytes", async () => rejects(withTrailing(await tinyZip()), "trailing"))
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

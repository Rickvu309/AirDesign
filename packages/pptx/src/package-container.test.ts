import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, ZipWriter, type ZipWriterAddDataOptions } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { ContainerError, readParts, type ContainerKind } from "./package-container.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const fixtureDir = `${process.cwd()}/scripts/pptx-fixtures`
const fixtureDecks = readdirSync(fixtureDir).filter((name) => name.endsWith(".pptx"))

function view(file: Uint8Array): DataView {
  return new DataView(file.buffer, file.byteOffset, file.byteLength)
}

async function zipOf(
  parts: Readonly<Record<string, string>>,
  options: ZipWriterAddDataOptions = {},
  comment?: Uint8Array,
): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter(), {
    level: 0,
    useWebWorkers: false,
    dataDescriptor: false,
    extendedTimestamp: false,
  })
  for (const [name, text] of Object.entries(parts)) {
    await writer.add(name, new Uint8ArrayReader(encodeUtf8(text)), options)
  }
  return comment === undefined ? writer.close() : writer.close(comment)
}

const twoParts = { "a.xml": "<first/>", "b.xml": "<last/>" }

function endOf(file: Uint8Array): number {
  return file.length - 22
}

function centralRecords(file: Uint8Array): readonly number[] {
  const data = view(file)
  const records: number[] = []
  let cursor = data.getUint32(endOf(file) + 16, true)
  while (cursor < endOf(file) && data.getUint32(cursor, true) === 0x02014b50) {
    records.push(cursor)
    cursor += 46 + data.getUint16(cursor + 28, true) + data.getUint16(cursor + 30, true)
  }
  return records
}

function centralAt(file: Uint8Array, index = 0): number {
  const at = centralRecords(file)[index]
  if (at === undefined) throw new Error(`central record ${index}`)
  return at
}

function renamed(file: Uint8Array, from: string, to: string): Uint8Array {
  const changed = file.slice()
  const target = encodeUtf8(from)
  let count = 0
  for (let index = 0; index + target.length <= changed.length; index += 1) {
    if (!sameBytes(changed.subarray(index, index + target.length), target)) continue
    changed.set(encodeUtf8(to), index)
    count += 1
  }
  expect(count).toBe(2)
  return changed
}

function withDirectoryBit(file: Uint8Array, index: number): Uint8Array {
  const changed = file.slice()
  const at = centralAt(changed, index)
  changed[at + 5] = 0
  changed[at + 38] = (changed[at + 38] ?? 0) | 0x10
  return changed
}

function underCount(file: Uint8Array): Uint8Array {
  const lying = file.slice()
  for (const field of [endOf(lying) + 8, endOf(lying) + 10]) {
    view(lying).setUint16(field, view(lying).getUint16(field, true) - 1, true)
  }
  return lying
}

function withLocalAndCentral(file: Uint8Array, localField: number, change: (value: number) => number): Uint8Array {
  const changed = file.slice()
  const data = view(changed)
  const central = centralAt(changed)
  const local = data.getUint32(central + 42, true)
  data.setUint32(local + localField, change(data.getUint32(local + localField, true)), true)
  data.setUint32(central + localField + 2, change(data.getUint32(central + localField + 2, true)), true)
  return changed
}

function withMethod(file: Uint8Array, method: number): Uint8Array {
  const changed = file.slice()
  const central = centralAt(changed)
  view(changed).setUint16(view(changed).getUint32(central + 42, true) + 8, method, true)
  view(changed).setUint16(central + 10, method, true)
  return changed
}

function reversedCentral(file: Uint8Array): Uint8Array {
  const first = centralAt(file, 0)
  const second = centralAt(file, 1)
  const swapped = file.slice()
  const tail = file.slice(second, endOf(file))
  swapped.set(tail, first)
  swapped.set(file.slice(first, second), first + tail.length)
  return swapped
}

function withTrailing(file: Uint8Array): Uint8Array {
  const longer = new Uint8Array(file.length + 3)
  longer.set(file, 0)
  return longer
}

async function refused(file: Uint8Array): Promise<ContainerKind> {
  const failure = await readParts(file).then(
    () => null,
    (error: unknown) => error,
  )
  expect(failure).toBeInstanceOf(ContainerError)
  return (failure as ContainerError).kind
}

async function zipReaderParts(file: Uint8Array): Promise<readonly (readonly [string, Uint8Array])[]> {
  const reader = new ZipReader(new Uint8ArrayReader(file), { checkAmbiguity: true })
  const parts: (readonly [string, Uint8Array])[] = []
  for (const entry of await reader.getEntries()) {
    if (entry.directory) throw new Error(entry.filename)
    parts.push([entry.filename, await entry.getData(new Uint8ArrayWriter())])
  }
  await reader.close()
  return parts
}

describe("readParts refuses each container kind", () => {
  it.each([
    ["comment", () => zipOf(twoParts, {}, Uint8Array.from([7]))],
    ["content", async () => withLocalAndCentral(await zipOf(twoParts), 14, (crc) => crc ^ 1)],
    ["directory", async () => withDirectoryBit(await zipOf(twoParts), 0)],
    [
      "disk",
      async () => {
        const file = await zipOf(twoParts)
        view(file).setUint16(endOf(file) + 4, 1, true)
        return file
      },
    ],
    ["duplicate", async () => renamed(await zipOf(twoParts), "b.xml", "a.xml")],
    ["method", async () => withMethod(await zipOf(twoParts), 12)],
    ["order", async () => reversedCentral(await zipOf(twoParts))],
    ["unaccounted", async () => withTrailing(await zipOf(twoParts))],
    [
      "unreadable",
      async () => {
        const file = await zipOf(twoParts)
        file[30] = "z".charCodeAt(0)
        return file
      },
    ],
    ["zip64", () => zipOf(twoParts, { zip64: true })],
  ] as const)("%s", async (kind, build) => {
    expect(await refused(await build())).toBe(kind)
  })
})

describe("readParts refuses the planted shapes", () => {
  it("a repeated name", async () => {
    expect(await refused(renamed(await zipOf(twoParts), "b.xml", "a.xml"))).toBe("duplicate")
  })

  it("a repeated name whose first copy has the MS-DOS directory bit with host byte 0", async () => {
    const repeated = withDirectoryBit(renamed(await zipOf(twoParts), "b.xml", "a.xml"), 0)
    expect(await refused(repeated)).toBe("duplicate")
  })

  it("a repeated name in another letter case", async () => {
    expect(await refused(renamed(await zipOf(twoParts), "b.xml", "A.xml"))).toBe("duplicate")
  })

  it("an extra entry with the MS-DOS directory bit", async () => {
    const extra = await zipOf({ ...twoParts, "c.xml": "<extra/>" })
    expect(await refused(withDirectoryBit(extra, 2))).toBe("directory")
  })

  it("17 central records under an end record that counts 16", async () => {
    const parts: Record<string, string> = {}
    for (let index = 0; index < 17; index += 1) parts[`p${String(index).padStart(2, "0")}.xml`] = "<a/>"
    const file = await zipOf(parts)
    await expect(readParts(file)).resolves.toHaveProperty("size", 17)
    expect(await refused(underCount(file))).toBe("unaccounted")
  })

  it("a second ppt/slides/slide1.xml hidden past the end record's count", async () => {
    const zip = await zipOf({ "ppt/slides/slide1.xml": "<good/>", "ppt/slides/slideX.xml": "<evil/>" })
    const hidden = renamed(zip, "ppt/slides/slideX.xml", "ppt/slides/slide1.xml")
    expect(await refused(underCount(hidden))).toBe("unaccounted")
  })

  it("a central entry whose compressed size disagrees with its local record", async () => {
    const file = await zipOf(twoParts)
    view(file).setUint32(centralAt(file) + 20, view(file).getUint32(centralAt(file) + 20, true) - 1, true)
    expect(await refused(file)).toBe("unreadable")
  })

  it("a stored part with a bad CRC", async () => {
    expect(await refused(withLocalAndCentral(await zipOf(twoParts), 14, (crc) => crc ^ 1))).toBe("content")
  })

  it("a stored part whose size disagrees with its stream", async () => {
    expect(await refused(withLocalAndCentral(await zipOf(twoParts), 22, (size) => size + 1))).toBe("content")
  })

  it("a deflated part with a bad CRC", async () => {
    const file = await zipOf({ "a.xml": "<first/>".repeat(40) }, { level: 6 })
    expect(view(file).getUint16(8, true)).toBe(8)
    expect(await refused(withLocalAndCentral(file, 14, (crc) => crc ^ 1))).toBe("content")
  })

  it("a deflated part whose size disagrees with its stream", async () => {
    const file = await zipOf({ "a.xml": "<first/>".repeat(40) }, { level: 6 })
    expect(await refused(withLocalAndCentral(file, 22, (size) => size + 1))).toBe("content")
  })
})

describe("readParts reads every fixture deck as zip.js does", () => {
  it.each(fixtureDecks)("%s", async (name) => {
    const file = readFileSync(`${fixtureDir}/${name}`)
    const expected = await zipReaderParts(file)
    const parts = await readParts(file)
    expect([...parts.keys()]).toEqual(expected.map(([part]) => part))
    for (const [part, bytes] of expected) expect(sameBytes(parts.get(part) ?? new Uint8Array(), bytes)).toBe(true)
  })
})

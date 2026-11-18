import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { markupDocument } from "./element-span.js"
import { markupBytesRead } from "./markup-reader.js"
import { packageLimits, readPackage, readPackageWith, scanMarkup } from "./package-limits.js"

const forced = vi.hoisted(() => ({ nodesPerPart: null as number | null }))

vi.mock("./element-span.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./element-span.js")>()
  return {
    ...original,
    markupLimits: (data: Uint8Array, keep?: boolean) =>
      forced.nodesPerPart === null
        ? original.markupLimits(data, keep)
        : { wellFormed: true, depth: 1, attributes: 0, nodes: forced.nodesPerPart },
  }
})

afterEach(() => {
  forced.nodesPerPart = null
})

function encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 255, (value >> 8) & 255)
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255)
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  let length = 0
  for (const chunk of chunks) length += chunk.length
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

const crcOfByte = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  return crc >>> 0
})

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < data.length; index += 1) {
    crc = (crc >>> 8) ^ (crcOfByte[(crc ^ (data[index] ?? 0)) & 255] ?? 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function storedZip(
  files: readonly {
    readonly name: string
    readonly size: number
    readonly flag?: number
    readonly data?: Uint8Array
    readonly declared?: number
  }[],
): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = Uint8Array.from(file.name, (char) => char.charCodeAt(0))
    const flag = file.flag ?? 0
    const payload = file.data ?? Uint8Array.of()
    const uncompressed = file.declared ?? file.size
    const crc = u32(crc32(payload))
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(flag),
      u16(0),
      u16(0),
      u16(0),
      crc,
      u32(payload.length),
      u32(uncompressed),
      u16(name.length),
      u16(0),
      name,
      payload,
    ])
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(flag),
        u16(0),
        u16(0),
        u16(0),
        crc,
        u32(payload.length),
        u32(uncompressed),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    )
    locals.push(local)
    offset += local.length
  }
  const central = concat(centrals)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])
  return concat([...locals, central, end])
}

async function zipOf(parts: Readonly<Record<string, string>>): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter())
  for (const [name, text] of Object.entries(parts)) {
    await writer.add(name, new Uint8ArrayReader(encode(text)), { level: 0 })
  }
  return writer.close()
}

async function deck(slide: string): Promise<Uint8Array> {
  return zipOf({
    "[Content_Types].xml": "<Types/>",
    "ppt/presentation.xml": "<p:presentation/>",
    "ppt/slides/slide1.xml": slide,
  })
}

async function slides(count: number): Promise<Uint8Array> {
  const parts: Record<string, string> = {
    "[Content_Types].xml": "<Types/>",
    "ppt/presentation.xml": "<p:presentation/>",
    "ppt/slides/slideNotes.xml": "<p:sld/>",
    "ppt/slides/slide1.xml.rels": "<Relationships/>",
    "ppt/slideLayouts/slideLayout1.xml": "<p:sldLayout/>",
  }
  for (let index = 1; index <= count; index += 1) parts[`ppt/slides/slide${index}.xml`] = "<p:sld/>"
  return zipOf(parts)
}

function named(count: number): { name: string; size: number }[] {
  const files: { name: string; size: number }[] = []
  for (let index = 0; index < count; index += 1) files.push({ name: `p${index}`, size: 0 })
  return files
}

const attributed = (count: number) => {
  let attrs = ""
  for (let index = 0; index < count; index += 1) attrs += ` a${index}="1"`
  return `<a${attrs}/>`
}

describe("readPackage", () => {
  it("reads a deck under the product bounds", async () => {
    expect(packageLimits).toEqual({
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
    })
    const read = await readPackage(await deck("<p:sld/>"))
    if (!read.ok) throw new Error(read.reason)
    const slide = read.parts.get("ppt/slides/slide1.xml")
    if (slide === undefined) throw new Error("slide")
    expect(decode(slide)).toBe("<p:sld/>")
    const parsed = markupBytesRead()
    expect(markupDocument(slide).elements[0]?.kind).toBe("p:sld")
    expect(markupBytesRead()).toBe(parsed)
    expect(await readPackage(await slides(50))).toMatchObject({ ok: true })
  })

  it("rejects a packed file at 70 MB and a zip that is not a deck", async () => {
    const under = await readPackage(new Uint8Array(69_999_999))
    expect(under).toEqual({ ok: false, reason: "zip" })
    expect(await readPackage(new Uint8Array(70_000_000))).toEqual({
      ok: false,
      reason: "limit",
      limit: "packedBytes",
    })
    expect(await readPackage(Uint8Array.from([1, 2, 3, 4]))).toEqual({ ok: false, reason: "zip" })
    expect(await readPackage(await zipOf({ "hello.txt": "hi" }))).toEqual({ ok: false, reason: "not-pptx" })
    expect(await readPackage(await zipOf({ "ppt/presentation.xml": "<p:presentation/>" }))).toEqual({
      ok: false,
      reason: "not-pptx",
    })
  })

  it("rejects one slide past the cap and keeps a notes name out of the count", async () => {
    expect(await readPackage(await slides(51))).toEqual({
      ok: false,
      reason: "limit",
      limit: "slides",
    })
  })

  it("rejects a part count, a declared part size, an unpacked sum, and an expansion ratio past the cap", async () => {
    expect(await readPackage(storedZip(named(packageLimits.parts)))).toEqual({ ok: false, reason: "not-pptx" })
    expect(await readPackage(storedZip(named(packageLimits.parts + 1)))).toEqual({
      ok: false,
      reason: "limit",
      limit: "parts",
    })
    const xmlAt = storedZip([{ name: "a.xml", size: packageLimits.xmlBytes }])
    const xmlOver = storedZip([{ name: "a.xml", size: packageLimits.xmlBytes + 1 }])
    expect(await readPackage(xmlAt)).toEqual({ ok: false, reason: "limit", limit: "ratio" })
    expect(await readPackage(xmlOver)).toEqual({ ok: false, reason: "limit", limit: "xmlBytes" })
    const relsOver = storedZip([{ name: "ppt/slides/_rels/slide1.xml.rels", size: packageLimits.xmlBytes + 1 }])
    expect(await readPackage(relsOver)).toEqual({ ok: false, reason: "limit", limit: "xmlBytes" })
    const binaryAt = storedZip([{ name: "a.png", size: packageLimits.binaryBytes }])
    const binaryOver = storedZip([{ name: "a.png", size: packageLimits.binaryBytes + 1 }])
    expect(await readPackage(binaryAt)).toEqual({ ok: false, reason: "limit", limit: "ratio" })
    expect(await readPackage(binaryOver)).toEqual({ ok: false, reason: "limit", limit: "binaryBytes" })
    const full = 7
    const rest = packageLimits.unpackedBytes - full * packageLimits.binaryBytes
    const unpackedFiles = (extra: number) => [
      ...Array.from({ length: full }, (_, index) => ({ name: `b${index}.png`, size: packageLimits.binaryBytes })),
      { name: "tail.png", size: rest + extra },
    ]
    expect(await readPackage(storedZip(unpackedFiles(0)))).toEqual({ ok: false, reason: "limit", limit: "ratio" })
    expect(await readPackage(storedZip(unpackedFiles(1)))).toEqual({
      ok: false,
      reason: "limit",
      limit: "unpackedBytes",
    })
    const shell = storedZip([{ name: "ppt/slides/slide1.xml", size: 0 }])
    const ratioAt = storedZip([{ name: "ppt/slides/slide1.xml", size: shell.length * packageLimits.ratio }])
    const ratioOver = storedZip([{ name: "ppt/slides/slide1.xml", size: shell.length * packageLimits.ratio + 1 }])
    expect(await readPackage(ratioAt)).toEqual({ ok: false, reason: "not-pptx" })
    expect(await readPackage(ratioOver)).toEqual({ ok: false, reason: "limit", limit: "ratio" })
    const payload = new Uint8Array(packageLimits.xmlBytes + 1)
    payload.fill(0x61)
    const types = encode("<Types/>")
    const presentation = encode("<p:presentation/>")
    const lying = storedZip([
      { name: "[Content_Types].xml", size: types.length, data: types, declared: types.length },
      { name: "ppt/presentation.xml", size: presentation.length, data: presentation, declared: presentation.length },
      { name: "ppt/slides/slide1.xml", size: 0, data: payload, declared: 0 },
    ])
    expect(await readPackage(lying)).toEqual({ ok: false, reason: "limit", limit: "xmlBytes" })
  }, 60_000)

  it("rejects an encrypted package before reading its parts", async () => {
    const locked = storedZip([
      { name: "[Content_Types].xml", size: 1, flag: 1 },
      { name: "ppt/presentation.xml", size: 1, flag: 1 },
    ])
    expect(await readPackage(locked)).toEqual({ ok: false, reason: "encrypted" })
  })

  it("reports a markup cap through the package path", async () => {
    const nested = (depth: number) => `${"<a>".repeat(depth)}${"</a>".repeat(depth)}`
    expect((await readPackage(await deck(nested(packageLimits.depth)))).ok).toBe(true)
    expect(await readPackage(await deck(nested(packageLimits.depth + 1)))).toEqual({
      ok: false,
      reason: "limit",
      limit: "depth",
    })
  })

  it("reports the node cap through the package path as the sum over three parts", async () => {
    const perPart = Math.floor(packageLimits.nodes / 3)
    const tiny = await deck("<a/>")
    forced.nodesPerPart = perPart
    expect((await readPackage(tiny)).ok).toBe(true)
    forced.nodesPerPart = perPart + 1
    expect(await readPackage(tiny)).toEqual({ ok: false, reason: "limit", limit: "nodes" })
  })

  it("reports the attribute cap through the package path", async () => {
    expect((await readPackage(await deck(attributed(packageLimits.attributes)))).ok).toBe(true)
    expect(await readPackage(await deck(attributed(packageLimits.attributes + 1)))).toEqual({
      ok: false,
      reason: "limit",
      limit: "attributes",
    })
  })

  it("does not treat comments, cdata, or quoted greater-than as markup", async () => {
    expect((await readPackage(await deck(`<a><![CDATA[${"<b>".repeat(packageLimits.depth + 1)}]]></a>`))).ok).toBe(true)
    expect((await readPackage(await deck(`<a><!-- ${"<b></b>".repeat(20)} --></a>`))).ok).toBe(true)
    expect((await readPackage(await deck(`<a b="${"=".repeat(300)}"/>`))).ok).toBe(true)
    expect((await readPackage(await deck(`<a b="x>y"/>`))).ok).toBe(true)
    expect(await readPackage(await deck("<a>"))).toEqual({ ok: false, reason: "xml" })
    expect(await readPackage(await deck("<a></b>"))).toEqual({ ok: false, reason: "xml" })
    expect(await readPackage(await deck("<a><!--"))).toEqual({ ok: false, reason: "xml" })
  })
})

describe("scanMarkup", () => {
  const small = { depth: 4, attributes: 3, nodes: 10 }
  const nested = (depth: number) => encode(`${"<a>".repeat(depth)}${"</a>".repeat(depth)}`)
  const siblings = (count: number) => encode("<a/>".repeat(count))

  it("accepts markup at each cap and names the cap one past it", () => {
    expect(scanMarkup(nested(small.depth), small, 0)).toEqual({ ok: true, nodes: small.depth })
    expect(scanMarkup(nested(small.depth + 1), small, 0)).toEqual({ ok: false, reason: "limit", limit: "depth" })
    expect(scanMarkup(encode(attributed(small.attributes)), small, 0)).toEqual({ ok: true, nodes: 1 })
    expect(scanMarkup(encode(attributed(small.attributes + 1)), small, 0)).toEqual({
      ok: false,
      reason: "limit",
      limit: "attributes",
    })
    expect(scanMarkup(siblings(small.nodes), small, 0)).toEqual({ ok: true, nodes: small.nodes })
    expect(scanMarkup(siblings(small.nodes + 1), small, 0)).toEqual({ ok: false, reason: "limit", limit: "nodes" })
  })

  it("counts nodes across parts", () => {
    expect(scanMarkup(siblings(4), small, 6)).toEqual({ ok: true, nodes: small.nodes })
    expect(scanMarkup(siblings(5), small, 6)).toEqual({ ok: false, reason: "limit", limit: "nodes" })
  })

  it("does not treat comments, cdata, or quoted greater-than as markup", () => {
    expect(scanMarkup(encode(`<a><![CDATA[${"<b>".repeat(small.depth + 1)}]]></a>`), small, 0)).toEqual({
      ok: true,
      nodes: 1,
    })
    expect(scanMarkup(encode(`<a><!-- ${"<b></b>".repeat(20)} --></a>`), small, 0)).toEqual({ ok: true, nodes: 1 })
    expect(scanMarkup(encode(`<a b="x>y"/>`), small, 0)).toEqual({ ok: true, nodes: 1 })
    expect(scanMarkup(encode(`<a b="${"=".repeat(300)}"/>`), small, 0)).toEqual({ ok: true, nodes: 1 })
  })

  it("rejects markup that is not well formed", () => {
    expect(scanMarkup(encode("<a>"), small, 0)).toEqual({ ok: false, reason: "xml" })
    expect(scanMarkup(encode("<a></b>"), small, 0)).toEqual({ ok: false, reason: "xml" })
  })
})

describe("readPackageWith", () => {
  const small = { ...packageLimits, depth: 4, attributes: 3, nodes: 10 }
  const otherNodes = 2
  const siblings = (count: number) => "<a/>".repeat(count)
  const twoSlides = (first: number, second: number) =>
    zipOf({
      "[Content_Types].xml": "<Types/>",
      "ppt/presentation.xml": "<p:presentation/>",
      "ppt/slides/slide1.xml": siblings(first),
      "ppt/slides/slide2.xml": siblings(second),
    })

  it("applies the injected attribute cap", async () => {
    expect((await readPackageWith(await deck(attributed(small.attributes)), small)).ok).toBe(true)
    expect(await readPackageWith(await deck(attributed(small.attributes + 1)), small)).toEqual({
      ok: false,
      reason: "limit",
      limit: "attributes",
    })
  })

  it("applies the injected node cap", async () => {
    expect((await readPackageWith(await deck(siblings(small.nodes - otherNodes)), small)).ok).toBe(true)
    expect(await readPackageWith(await deck(siblings(small.nodes - otherNodes + 1)), small)).toEqual({
      ok: false,
      reason: "limit",
      limit: "nodes",
    })
  })

  it("counts nodes across parts, each under the cap and their sum over it", async () => {
    expect((await readPackageWith(await twoSlides(4, 4), small)).ok).toBe(true)
    expect(await readPackageWith(await twoSlides(5, 5), small)).toEqual({ ok: false, reason: "limit", limit: "nodes" })
  })
})

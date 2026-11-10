import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { exportPackage, samePartBytes } from "./export-package.js"
import { readPackage } from "./package-limits.js"

function text(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0))
}

const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="missing.xml"/></Relationships>`

function deck(): Map<string, Uint8Array> {
  return new Map([
    ["[Content_Types].xml", text("<Types/>")],
    ["ppt/presentation.xml", text("<p:presentation/>")],
    ["ppt/slides/slide1.xml", text("<p:sld/>")],
    ["ppt/slides/_rels/slide1.xml.rels", text(rels)],
    ["ppt/media/keep.bin", Uint8Array.from([1, 0, 255])],
  ])
}

async function zipped(parts: ReadonlyMap<string, Uint8Array>): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter())
  for (const [name, data] of parts) await writer.add(name, new Uint8ArrayReader(data))
  return writer.close()
}

describe("exportPackage", () => {
  it("re-imports every part byte, including a dangling relationship and a media part", async () => {
    const parts = deck()
    const packed = await exportPackage(await zipped(parts), parts)
    const read = await readPackage(packed)
    if (!read.ok) throw new Error(read.reason)
    expect(read.parts.size).toBe(parts.size)
    for (const [name, data] of parts) expect(read.parts.get(name)).toEqual(data)
    const copied = read.parts.get("ppt/slides/_rels/slide1.xml.rels")
    if (copied === undefined) throw new Error("rels")
    expect(text(rels)).toEqual(copied)
  })

  it("rejects a file the reader refuses", async () => {
    const original = await zipped(deck())
    const broken = deck()
    broken.set("ppt/slides/slide1.xml", text("<a>"))
    await expect(exportPackage(original, broken)).rejects.toThrow(/xml/)
    await expect(exportPackage(original, new Map([["ppt/slides/slide1.xml", text("<p:sld/>")]]))).rejects.toThrow(
      /not-pptx/,
    )
  })

  it("rejects a part the re-import drops", async () => {
    const parts = deck()
    const original = await zipped(parts)
    parts.set("ppt/extra/", text("x"))
    await expect(exportPackage(original, parts)).rejects.toThrow(/part/)
  })
})

describe("samePartBytes", () => {
  it("accepts the same bytes and rejects one changed byte", () => {
    const media = Uint8Array.from([1, 0, 255])
    const parts = new Map([["ppt/media/keep.bin", media]])
    expect(samePartBytes(parts, new Map([["ppt/media/keep.bin", Uint8Array.from(media)]]))).toBe(true)
    const changed = Uint8Array.from(media)
    changed[1] = 2
    expect(samePartBytes(parts, new Map([["ppt/media/keep.bin", changed]]))).toBe(false)
  })
})

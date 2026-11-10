import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { decodeUtf8, encodeUtf8, readParts, roundTripPackage } from "./package-bytes.js"

function encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index)
  return bytes
}

function decode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
}

async function zipOf(parts: Readonly<Record<string, string>>): Promise<Uint8Array> {
  const writer = new ZipWriter<Uint8Array>(new Uint8ArrayWriter())
  for (const [name, text] of Object.entries(parts)) {
    await writer.add(name, new Uint8ArrayReader(encode(text)))
  }
  return writer.close()
}

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="missing.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/a" TargetMode="External"/></Relationships>`

describe("utf8", () => {
  it("round-trips a 3-byte character and an emoji", () => {
    expect(Array.from(encodeUtf8("€"))).toEqual([0xe2, 0x82, 0xac])
    expect(decodeUtf8(encodeUtf8("€"))).toBe("€")
    expect(Array.from(encodeUtf8("😀"))).toEqual([0xf0, 0x9f, 0x98, 0x80])
    expect(decodeUtf8(Uint8Array.from([0xf0, 0x9f, 0x98, 0x80]))).toBe("😀")
    expect(decodeUtf8(encodeUtf8("a😀b"))).toBe("a😀b")
  })
})

describe("roundTripPackage", () => {
  it("round-trips a dangling relationship part byte for byte", async () => {
    const packed = await zipOf({
      "[Content_Types].xml": "<Types></Types>",
      "ppt/slides/slide1.xml": "<p:sld/>",
      "ppt/slides/_rels/slide1.xml.rels": rels,
    })
    const before = await readParts(packed)
    const after = await readParts(await roundTripPackage(packed))
    const name = "ppt/slides/_rels/slide1.xml.rels"
    const original = before.get(name)
    const copied = after.get(name)
    if (original === undefined || copied === undefined) throw new Error(name)
    expect(copied).toEqual(original)
    expect(decode(copied)).toContain('Target="missing.xml"')
    expect(decode(copied)).toContain('TargetMode="External"')
    expect(after.get("ppt/slides/slide1.xml")).toEqual(before.get("ppt/slides/slide1.xml"))
  })
})

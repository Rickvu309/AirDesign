import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from "@zip.js/zip.js"
import { describe, expect, it } from "vitest"
import { carryParts, decodeUtf8, encodeUtf8, readParts } from "./package-bytes.js"

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

describe("carryParts", () => {
  it("keeps a relationship whose target is missing", () => {
    const xml = `<Relationships><Relationship Id="rId1" Target="missing.xml"/></Relationships>`
    const name = "ppt/slides/_rels/slide1.xml.rels"
    const bytes = encodeUtf8(xml)
    expect(carryParts(new Map([[name, bytes]])).get(name)).toBe(bytes)
  })

  it("keeps an external relationship", () => {
    const xml = `<Relationships><Relationship Id="rId2" Target="https://example.com/a" TargetMode="External"/></Relationships>`
    const name = "ppt/slides/_rels/slide1.xml.rels"
    const bytes = encodeUtf8(xml)
    const carried = carryParts(
      new Map([
        [name, bytes],
        ["ppt/slides/slide1.xml", encodeUtf8("<p:sld/>")],
      ]),
    )
    expect(carried.get(name)).toBe(bytes)
  })
})

describe("utf8", () => {
  it("round-trips a 3-byte character and an emoji", () => {
    expect(Array.from(encodeUtf8("€"))).toEqual([0xe2, 0x82, 0xac])
    expect(decodeUtf8(encodeUtf8("€"))).toBe("€")
    expect(Array.from(encodeUtf8("😀"))).toEqual([0xf0, 0x9f, 0x98, 0x80])
    expect(decodeUtf8(Uint8Array.from([0xf0, 0x9f, 0x98, 0x80]))).toBe("😀")
    expect(decodeUtf8(encodeUtf8("a😀b"))).toBe("a😀b")
  })
})

describe("readParts", () => {
  function underCount(zip: Uint8Array): Uint8Array {
    const lying = Uint8Array.from(zip)
    let end = lying.length - 22
    while (decode(lying.subarray(end, end + 4)) !== "PK\x05\x06") end -= 1
    for (const field of [end + 8, end + 10]) lying[field] = (lying[field] ?? 0) - 1
    return lying
  }

  it("refuses 17 central records under an end record that counts 16", async () => {
    const parts: Record<string, string> = {}
    for (let index = 0; index < 17; index += 1) parts[`p${String(index).padStart(2, "0")}.xml`] = "<a/>"
    await expect(readParts(await zipOf(parts))).resolves.toHaveProperty("size", 17)
    await expect(readParts(underCount(await zipOf(parts)))).rejects.toThrow()
  })

  it("refuses a second slide1.xml hidden past the end record's count", async () => {
    const zip = await zipOf({ "ppt/slides/slide1.xml": "<good/>", "ppt/slides/slideX.xml": "<evil/>" })
    const hidden = Uint8Array.from(zip)
    let renamed = 0
    for (let index = 0; index + 21 <= hidden.length; index += 1) {
      if (decode(hidden.subarray(index, index + 21)) !== "ppt/slides/slideX.xml") continue
      hidden[index + 16] = "1".charCodeAt(0)
      renamed += 1
    }
    expect(renamed).toBe(2)
    await expect(readParts(underCount(hidden))).rejects.toThrow()
  })

  it("refuses an entry that claims to be a directory", async () => {
    const zip = await zipOf({ "a.xml": "<first/>", "b.xml": "<last/>" })
    const marked = Uint8Array.from(zip)
    let central = 0
    while (decode(marked.subarray(central, central + 4)) !== "PK\x01\x02") central += 1
    marked[central + 5] = 0
    marked[central + 38] = (marked[central + 38] ?? 0) | 0x10
    await expect(readParts(marked)).rejects.toThrow("directory entry a.xml")
  })

  it("refuses a zip that names one part twice", async () => {
    const zip = await zipOf({ "a.xml": "<first/>", "b.xml": "<last/>" })
    const repeated = Uint8Array.from(zip)
    let renamed = 0
    for (let index = 0; index + 5 <= repeated.length; index += 1) {
      if (decode(repeated.subarray(index, index + 5)) !== "b.xml") continue
      repeated[index] = "a".charCodeAt(0)
      renamed += 1
    }
    expect(renamed).toBe(2)
    await expect(readParts(repeated)).rejects.toThrow("Ambiguous archive")
  })

  it("refuses a repeated name whose first copy claims to be a directory", async () => {
    const zip = await zipOf({ "a.xml": "<first/>", "b.xml": "<last/>" })
    const repeated = Uint8Array.from(zip)
    for (let index = 0; index + 5 <= repeated.length; index += 1) {
      if (decode(repeated.subarray(index, index + 5)) === "b.xml") repeated[index] = "a".charCodeAt(0)
    }
    let central = 0
    while (decode(repeated.subarray(central, central + 4)) !== "PK\x01\x02") central += 1
    repeated[central + 5] = 0
    repeated[central + 38] = (repeated[central + 38] ?? 0) | 0x10
    await expect(readParts(repeated)).rejects.toThrow("Ambiguous archive")
  })
})

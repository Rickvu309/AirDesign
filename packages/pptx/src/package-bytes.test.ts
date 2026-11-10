import { describe, expect, it } from "vitest"
import { carryParts, decodeUtf8, encodeUtf8 } from "./package-bytes.js"

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

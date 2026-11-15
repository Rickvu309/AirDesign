import { describe, expect, it } from "vitest"
import { carryParts, decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"

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

  it("keeps a lone surrogate as three bytes and reads it back", () => {
    expect(Array.from(encodeUtf8("\ud800"))).toEqual([0xed, 0xa0, 0x80])
    expect(Array.from(encodeUtf8("a\udfffb"))).toEqual([0x61, 0xed, 0xbf, 0xbf, 0x62])
    expect(Array.from(encodeUtf8("\udc00\ud800"))).toEqual([0xed, 0xb0, 0x80, 0xed, 0xa0, 0x80])
    expect(decodeUtf8(Uint8Array.from([0xed, 0xa0, 0x80]))).toBe("\ud800")
  })

  it("encodes the edges of each width", () => {
    expect(Array.from(encodeUtf8("\u007f\u0080\u07ff\u0800\uffff"))).toEqual([
      0x7f, 0xc2, 0x80, 0xdf, 0xbf, 0xe0, 0xa0, 0x80, 0xef, 0xbf, 0xbf,
    ])
    expect(Array.from(encodeUtf8("\u{10ffff}"))).toEqual([0xf4, 0x8f, 0xbf, 0xbf])
    expect(encodeUtf8("")).toEqual(new Uint8Array())
  })

  it("refuses a cut sequence and a code point past the last one", () => {
    expect(() => decodeUtf8(Uint8Array.from([0xe2, 0x82]))).toThrow("utf8")
    expect(() => decodeUtf8(Uint8Array.from([0xe2, 0x41, 0xac]))).toThrow("utf8")
    expect(() => decodeUtf8(Uint8Array.from([0xf7, 0xbf, 0xbf, 0xbf]))).toThrow(RangeError)
  })

  it("reads back every code unit and every plane it writes, lone surrogates and all", () => {
    const units = String.fromCharCode(...Array.from({ length: 0x10000 }, (_, code) => code).reverse())
    expect(decodeUtf8(encodeUtf8(units))).toBe(units)
    const planes = Array.from({ length: 0x110 }, (_, plane) => String.fromCodePoint(plane * 0x1000 + 0x123)).join("")
    expect(decodeUtf8(encodeUtf8(planes))).toBe(planes)
  })

  it("reads a text longer than one chunk", () => {
    const text = "ab€😀".repeat(5000)
    expect(decodeUtf8(encodeUtf8(text))).toBe(text)
    expect(encodeUtf8(text).length).toBe(5000 * 9)
  })
})

describe("sameBytes", () => {
  const filled = (length: number) => Uint8Array.from({ length }, (_, index) => (index * 31) & 255)

  it("compares every length from empty through two words and a tail", () => {
    for (let length = 0; length <= 11; length += 1) {
      expect(sameBytes(filled(length), filled(length))).toBe(true)
      for (let at = 0; at < length; at += 1) {
        const changed = filled(length)
        changed[at] = (changed[at] ?? 0) ^ 1
        expect(sameBytes(filled(length), changed)).toBe(false)
      }
    }
  })

  it("compares views that start at any offset in their buffers", () => {
    const wide = filled(40)
    for (let left = 0; left < 4; left += 1) {
      for (let right = 0; right < 4; right += 1) {
        const other = new Uint8Array(40)
        other.set(wide.subarray(left, left + 24), right)
        expect(sameBytes(wide.subarray(left, left + 24), other.subarray(right, right + 24))).toBe(true)
        other[right + 23] = (other[right + 23] ?? 0) ^ 1
        expect(sameBytes(wide.subarray(left, left + 24), other.subarray(right, right + 24))).toBe(false)
      }
    }
  })

  it("tells a different length from a different byte", () => {
    expect(sameBytes(filled(8), filled(9))).toBe(false)
    const same = filled(8)
    expect(sameBytes(same, same)).toBe(true)
  })
})

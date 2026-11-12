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

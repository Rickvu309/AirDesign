import { describe, expect, it } from "vitest"
import { encodeUtf8 } from "./package-bytes.js"
import { crc32 } from "./crc32.js"

declare const process: {
  getBuiltinModule(name: "node:zlib"): { crc32(data: Uint8Array): number }
}

const zlib = process.getBuiltinModule("node:zlib")

const bytesOf = (length: number, seed: number) => {
  const bytes = new Uint8Array(length)
  let state = seed
  for (let at = 0; at < length; at += 1) {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0
    bytes[at] = state >>> 24
  }
  return bytes
}

describe("crc32", () => {
  it("gives the check value of 123456789", () => {
    expect(crc32(encodeUtf8("123456789"))).toBe(0xcbf43926)
  })

  it("matches zlib on every length up to 70 and on each starting offset", () => {
    const whole = bytesOf(80, 7)
    for (let start = 0; start < 9; start += 1) {
      for (let length = 0; start + length <= 70; length += 1) {
        const part = whole.subarray(start, start + length)
        expect(crc32(part)).toBe(zlib.crc32(part))
      }
    }
  })

  it("matches zlib on all zero, all one and a long run", () => {
    for (const bytes of [new Uint8Array(1031), new Uint8Array(1031).fill(0xff), bytesOf(1_048_583, 11)]) {
      expect(crc32(bytes)).toBe(zlib.crc32(bytes))
    }
  })
})

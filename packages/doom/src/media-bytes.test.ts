import { describe, expect, it } from "vitest"
import { limits } from "./limits.js"
import { mediaSize, mediaTypeOf, mediaTypes, overPixelLimit } from "./media-bytes.js"

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x40, 0x01, 0xf0, 0x00])
const jpeg = new Uint8Array([
  0xff,
  0xd8,
  0xff,
  0xc0,
  0x00,
  0x11,
  0x08,
  0x01,
  0xe0,
  0x02,
  0x80,
  0x03,
  ...Array.from({ length: 9 }, () => 0),
])
const ascii = (text: string) => Uint8Array.from(text, (letter) => letter.charCodeAt(0))
const webp = ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ")
const svg = ascii('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')

describe("an image's type and size read from its bytes", () => {
  it("names PNG, JPEG and GIF from their first bytes and nothing else", () => {
    expect(mediaTypeOf(png(1, 1))).toBe("image/png")
    expect(mediaTypeOf(jpeg)).toBe("image/jpeg")
    expect(mediaTypeOf(gif)).toBe("image/gif")
    expect(mediaTypeOf(webp)).toBeNull()
    expect(mediaTypeOf(svg)).toBeNull()
    expect(mediaTypeOf(new Uint8Array())).toBeNull()
  })

  it("reads the pixel size a PNG, a GIF or a JPEG declares", () => {
    expect(mediaSize(png(480, 320))).toEqual({ width: 480, height: 320 })
    expect(mediaSize(gif)).toEqual({ width: 320, height: 240 })
    expect(mediaSize(jpeg)).toEqual({ width: 640, height: 480 })
    expect(mediaSize(png(0, 320))).toBeNull()
    expect(mediaSize(webp)).toBeNull()
  })

  it("finds an image whose pixels pass forty million, however small its file", () => {
    const declared = mediaSize(png(30_000, 30_000))
    expect(declared).toEqual({ width: 30_000, height: 30_000 })
    expect(declared !== null && overPixelLimit(declared)).toBe(true)
    expect(overPixelLimit({ width: 8000, height: 5000 })).toBe(false)
    expect(overPixelLimit({ width: 8000, height: 5001 })).toBe(true)
  })
})

it("accepts PNG, JPEG and GIF and keeps one picture under its own limit", () => {
  expect(mediaTypes).toEqual(["image/png", "image/jpeg", "image/gif"])
  expect(limits.media).toBe(10_000_000)
  expect(limits.media).toBeLessThan(limits.bytes)
})

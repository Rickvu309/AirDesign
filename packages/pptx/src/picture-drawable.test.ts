import { describe, expect, it } from "vitest"
import { filePixels } from "./bitmap-file.js"
import { pairedBlit } from "./metafile-pair.js"
import type { Blit } from "./metafile-play.js"
import { drawablePicture } from "./picture-drawable.js"

const hash = (hex: string) => `#${hex}`

function joined(pieces: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0))
  let at = 0
  for (const piece of pieces) {
    bytes.set(piece, at)
    at += piece.length
  }
  return bytes
}

const longs = (values: readonly number[]) => new Uint8Array(Uint32Array.from(values, (value) => value >>> 0).buffer)
const shorts = (values: readonly number[]) => new Uint8Array(Uint16Array.from(values, (value) => value & 0xffff).buffer)

function emf(...records: Uint8Array[]): Uint8Array {
  const header = longs([1, 88, 0, 0, 99, 49, 0, 0, 1000, 500, 0x464d4520, 0x10000, 0, 0, 0, 0, 0, 0, 100, 50, 10, 5])
  return joined([header, ...records, longs([14, 20, 0, 16, 20])])
}

const record = (type: number, values: readonly number[]) => longs([type, 8 + values.length * 4, ...values])

function dib(bits: number, width: number, rows: readonly number[], palette: readonly number[]): Uint8Array {
  const info = longs([40, width, rows.length, 1 | (bits << 16), 0, 0, 0, 0, palette.length, 0, ...palette])
  return joined([info, longs(rows)])
}

function stretched(operation: number, bitmap: Uint8Array, infoBytes: number): Uint8Array {
  const fixed = 80
  return joined([
    longs([81, fixed + bitmap.length, 0, 0, 0, 0, 10, 20, 0, 0, 2, 1, fixed, infoBytes, fixed + infoBytes]),
    longs([bitmap.length - infoBytes, 0, operation, 40, 30]),
    bitmap,
  ])
}

function svgOf(bytes: Uint8Array): string {
  const drawn = drawablePicture(bytes)
  if (drawn === null || typeof drawn.data !== "string") throw new Error("no SVG drawn")
  return drawn.data
}

const white = 0xffffff
const box = { left: 0, top: 0, right: 2, bottom: 1 }

function bitmapBlit(operation: number, row: number): Blit {
  const bitmap = dib(1, 2, [row], [0, white])
  const file = joined([Uint8Array.of(0x42, 0x4d), longs([14 + bitmap.length, 0, 14 + 48]), bitmap])
  return { dest: box, source: box, bitmap: { file, width: 2, height: 1, bottomUp: true }, operation, opacity: 1 }
}

describe("drawablePicture", () => {
  it("draws an EMF rectangle in its brush inside the frame the file names", () => {
    const drawn = drawablePicture(emf(record(39, [1, 0, 0x996633, 0]), record(37, [1]), record(43, [10, 10, 60, 40])))
    expect(drawn?.contentType).toBe("image/svg+xml")
    expect(drawn?.data).toContain('viewBox="0 0 100 50"')
    expect(drawn?.data).toContain(`d="M10 10L60 10L60 40L10 40Z" fill="${hash("336699")}"`)
  })

  it("maps an EMF window onto its viewport and keeps a null pen from stroking", () => {
    const svg = svgOf(
      emf(
        record(17, [8]),
        record(9, [1000, 500]),
        record(11, [100, 50]),
        record(37, [0x80000008]),
        record(43, [100, 100, 600, 400]),
      ),
    )
    expect(svg).toContain('d="M10 10L60 10L60 40L10 40Z"')
    expect(svg).not.toContain("stroke=")
  })

  it("places each EMF character at the advance the file gives it", () => {
    const face = shorts([..."Arial"].map((letter) => letter.charCodeAt(0)))
    const font = joined([longs([82, 104, 1, -20, 0, 0, 0, 700, 0, 0]), face, new Uint8Array(54)])
    const text = joined([
      longs([84, 88, 0, 0, 0, 0, 1, 0, 0, 10, 30, 2, 76, 0, 0, 0, 0, 0, 80]),
      shorts([0x41, 0x42]),
      longs([15, 25]),
    ])
    const svg = svgOf(emf(font, record(37, [1]), record(22, [24]), text))
    expect(svg).toContain(`<text x="10 25" y="30 30" font-family="'Arial', sans-serif" font-size="20"`)
    expect(svg).toContain('font-weight="700"')
    expect(svg).toContain(">AB</text>")
  })

  it("joins the two halves of a masked EMF bitmap into one picture", () => {
    const lit = dib(1, 2, [0b01000000], [0, white])
    const mask = dib(1, 2, [0b10000000], [0, white])
    const svg = svgOf(emf(stretched(0xee0086, lit, 48), stretched(0x8800c6, mask, 48)))
    expect(svg.match(/<image /g)).toHaveLength(1)
    expect(svg).not.toContain("mix-blend-mode")
  })

  it("draws the bitmap of a placeable WMF across the window the file sets", () => {
    const bitmap = dib(24, 1, [0x00ff00], [])
    const header = joined([
      longs([0x9ac6cdd7]),
      shorts([0, 0, 0, 200, 100, 1440, 0, 0, 0]),
      shorts([1, 9, 0x300, 0, 0, 0, 0, 0, 0]),
    ])
    const words = (type: number, values: readonly number[]) =>
      joined([longs([3 + values.length]), shorts([type, ...values])])
    const blit = joined([
      longs([(26 + bitmap.length) / 2]),
      shorts([0x0b41]),
      longs([0xcc0020]),
      shorts([1, 1, 0, 0, 100, 200, 0, 0]),
      bitmap,
    ])
    const svg = svgOf(joined([header, words(0x020b, [0, 0]), words(0x020c, [100, 200]), blit, words(0, [])]))
    expect(svg).toContain('viewBox="0 0 200 100"')
    expect(svg).toContain('<svg x="0" y="0" width="200" height="100" viewBox="0 0 1 1"')
  })

  it("decodes an uncompressed TIFF into a bitmap the browser can show", () => {
    const entries = [
      [256, 3, 1, 2],
      [257, 3, 1, 1],
      [258, 3, 1, 8],
      [259, 3, 1, 1],
      [262, 3, 1, 2],
      [273, 4, 1, 122],
      [277, 3, 1, 3],
      [278, 3, 1, 1],
      [279, 4, 1, 6],
    ]
    const directory = joined([
      shorts([entries.length]),
      ...entries.map(([tag = 0, type = 0, count = 0, value = 0]) =>
        joined([shorts([tag, type]), longs([count, value])]),
      ),
      longs([0]),
    ])
    const drawn = drawablePicture(
      joined([Uint8Array.of(0x49, 0x49, 42, 0), longs([8]), directory, Uint8Array.of(255, 0, 0, 0, 0, 255)]),
    )
    expect(drawn?.contentType).toBe("image/bmp")
    const pixels = drawn === null || typeof drawn.data === "string" ? null : filePixels(drawn.data)
    expect(pixels === null ? null : { width: pixels.width, height: pixels.height, rgba: [...pixels.rgba] }).toEqual({
      width: 2,
      height: 1,
      rgba: [255, 0, 0, 255, 0, 0, 255, 255],
    })
  })

  it.each([
    ["nothing", new Uint8Array()],
    ["a PNG", Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0)],
    ["a cut EMF header", emf().subarray(0, 40)],
  ])("draws nothing from %s", (_, bytes) => {
    expect(drawablePicture(bytes)).toBeNull()
  })
})

describe("pairedBlit", () => {
  it("lets the background show where the lit half is black and the mask white", () => {
    const joinedBlit = pairedBlit(bitmapBlit(0xee0086, 0b01000000), bitmapBlit(0x8800c6, 0b10000000))
    const pixels = joinedBlit?.bitmap === null || joinedBlit === null ? null : filePixels(joinedBlit.bitmap.file)
    expect(joinedBlit?.operation).toBe(0xcc0020)
    expect([...(pixels?.rgba ?? [])]).toEqual([0, 0, 0, 0, 0, 0, 0, 255])
  })

  it("leaves two bitmaps drawn at different places apart", () => {
    const moved = { ...bitmapBlit(0x8800c6, 0), dest: { ...box, left: 1 } }
    expect(pairedBlit(bitmapBlit(0xee0086, 0), moved)).toBeNull()
  })
})

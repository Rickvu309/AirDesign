import { describe, expect, it } from "vitest"
import { filePixels } from "./bitmap-file.js"
import { readContainer, stored } from "./package-container.js"
import { drawablePicture } from "./picture-drawable.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
  getBuiltinModule(name: "node:zlib"): { inflateRawSync(data: Uint8Array): Uint8Array }
}

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const { inflateRawSync } = process.getBuiltinModule("node:zlib")
const corpus = `${process.cwd()}/scripts/pptx-fixtures/corpus`

const unshownMedia = /^ppt\/media\/[^/]+\.(emf|wmf|tiff?)$/i

const pictures = readdirSync(corpus)
  .filter((name) => name.endsWith(".pptx"))
  .flatMap((deck) =>
    readContainer(new Uint8Array(readFileSync(`${corpus}/${deck}`)))
      .filter((record) => unshownMedia.test(record.name))
      .map((record) => ({
        name: `${deck.replace(/\.pptx$/, "")} ${record.name.replace("ppt/media/", "")}`,
        bytes: record.method === stored ? record.stream : inflateRawSync(record.stream),
      })),
  )

const picture = (name: string): string => {
  const drawn = drawablePicture(pictures.find((each) => each.name === name)?.bytes ?? new Uint8Array())
  return typeof drawn?.data === "string" ? drawn.data : ""
}

const count = (svg: string, pattern: RegExp) => svg.match(pattern)?.length ?? 0

describe("drawablePicture on the corpus", () => {
  it("finds the pictures a browser cannot show", () => {
    expect(pictures.map((each) => each.name.split(" ")[0]).sort()).toEqual([
      "nasa-accp-visualizations",
      ...Array.from({ length: 9 }, () => "nasa-collaborative-testing"),
      "nasa-cots-parts-nesc",
      "nasa-hera-analog-lessons",
      "nasa-on-orbit-failures",
    ])
  })

  it.each(pictures.map((each) => [each.name, each.bytes] as const))("draws %s", (_, bytes) => {
    expect(drawablePicture(bytes)).not.toBeNull()
  })

  it("draws a chart's lines and the outlines of its words as vectors in the file's frame", () => {
    const svg = picture("nasa-collaborative-testing image22.emf")
    expect(count(svg, /<path /g)).toBeGreaterThan(100)
    expect(count(svg, /C/g)).toBeGreaterThan(100)
    expect(svg).toContain('viewBox="0 0 826.99 734.97"')
  })

  it("draws each masked label of a slide graphic as one picture", () => {
    const svg = picture("nasa-accp-visualizations image4.emf")
    expect(count(svg, /<image /g)).toBe(14)
    expect(svg).not.toContain("mix-blend-mode")
  })

  it.each(["nasa-hera-analog-lessons image2.wmf", "nasa-cots-parts-nesc image1.wmf"])(
    "draws the logo bitmap a WMF holds: %s",
    (name) => {
      expect(count(picture(name), /<image /g)).toBe(1)
    },
  )

  it("decodes a TIFF compressed with LZW and a predictor", () => {
    const drawn = drawablePicture(pictures.find((each) => each.name.endsWith("image3.tiff"))?.bytes ?? new Uint8Array())
    const pixels = drawn === null || typeof drawn.data === "string" ? null : filePixels(drawn.data)
    expect(pixels === null ? null : [pixels.width, pixels.height]).toEqual([809, 669])
    const middle = ((pixels?.width ?? 0) * 140 + 400) * 4
    const [red = 0, green = 0, blue = 0] = pixels?.rgba.subarray(middle, middle + 3) ?? []
    expect(red > green && green > blue).toBe(true)
  })
})

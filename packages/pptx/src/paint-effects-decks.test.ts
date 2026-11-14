import { describe, expect, it } from "vitest"

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
import { readContainer, stored } from "./package-container.js"
import { paintReader } from "./paint-reader.js"

const corpus = `${process.cwd()}/scripts/pptx-fixtures/corpus`
const decks = readdirSync(corpus).filter((name) => name.endsWith(".pptx"))
const paintedParts =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|(slides|slideLayouts|slideMasters|theme|media)\/(_rels\/)?[^/]+)$/

const partsOf = (name: string): ReadonlyMap<string, Uint8Array> =>
  new Map(
    readContainer(new Uint8Array(readFileSync(`${corpus}/${name}`)))
      .filter((record) => record.name === "[Content_Types].xml" || paintedParts.test(record.name))
      .map((record) => [record.name, record.method === stored ? record.stream : inflateRawSync(record.stream)]),
  )

const slidesOf = (parts: ReadonlyMap<string, Uint8Array>) =>
  [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))

describe("effect paint on the real decks", () => {
  it("reads a shadow for each of the 40 slide shapes that has one, from the file or from the theme style", () => {
    const seen = { shadows: 0, withAlpha: 0, glows: 0, softEdges: 0, aligned: 0 }
    for (const name of decks) {
      const parts = partsOf(name)
      const reader = paintReader(parts)
      for (const part of slidesOf(parts)) {
        for (const element of reader.slide(part).elements) {
          const { shadow, glow, softEdge } = element.effects ?? {}
          if (shadow !== undefined) seen.shadows += 1
          if (shadow !== undefined && shadow.color.alpha < 1) seen.withAlpha += 1
          if (shadow !== undefined && shadow.align !== "b") seen.aligned += 1
          if (glow !== undefined) seen.glows += 1
          if (softEdge !== undefined) seen.softEdges += 1
        }
      }
    }
    expect(seen).toEqual({ shadows: 40, withAlpha: 40, glows: 1, softEdges: 0, aligned: 1 })
  }, 60_000)

  it("reads the shadow of a shape whose effects come from the theme's second style", () => {
    const parts = partsOf("nasa-class-d-mar.pptx")
    const shape = paintReader(parts)
      .slide("ppt/slides/slide5.xml")
      .elements.find((element) => element.from === "slide" && element.shape === "4")
    expect(shape?.effects?.shadow).toMatchObject({
      blur: 40000,
      distance: 23000,
      direction: 90,
      rotateWithShape: false,
      color: { hex: "000000", alpha: 0.35 },
    })
  })
})

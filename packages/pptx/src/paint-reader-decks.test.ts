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
import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8 } from "./package-bytes.js"
import { readContainer, stored } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { addedPicturePart } from "./picture-write.js"
import { readShapes, readSlides } from "./read-shapes.js"

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`
const decks = [
  ...readdirSync(fixtures).map((name) => `${fixtures}/${name}`),
  ...readdirSync(`${fixtures}/corpus`).map((name) => `${fixtures}/corpus/${name}`),
].filter((path) => path.endsWith(".pptx"))

const paintedParts =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|(slides|slideLayouts|slideMasters|theme|media)\/(_rels\/)?[^/]+)$/

const markupParts = (path: string): ReadonlyMap<string, Uint8Array> =>
  new Map(
    readContainer(new Uint8Array(readFileSync(path)))
      .filter((record) => record.name === "[Content_Types].xml" || paintedParts.test(record.name))
      .map((record) => [record.name, record.method === stored ? record.stream : inflateRawSync(record.stream)]),
  )

const hiddenRows = (bytes: Uint8Array): readonly string[] => {
  const { elements } = markupDocument(bytes)
  const isHidden = (element: MarkupElement) =>
    element.kind === "p:cNvPr" &&
    element.attributes.some((item) => item.name === "hidden" && (item.value === "1" || item.value === "true"))
  const hiddenShapes = new Set(elements.filter(isHidden).map((item) => elements[item.parent]?.parent))
  const shown = 0
  const hidden = 1
  const fallback = 2
  const states = new Uint8Array(elements.length)
  const rows: string[] = []
  for (const element of elements) {
    const above = states[element.parent] ?? shown
    if (element.kind === "mc:Fallback" || above === fallback) states[element.index] = fallback
    else states[element.index] = hiddenShapes.has(element.index) || above === hidden ? hidden : shown
    if (element.kind === "p:cNvPr" && element.id !== null && states[element.index] === hidden) rows.push(element.id)
  }
  return rows
}

const mayHide = (bytes: Uint8Array): boolean => decodeUtf8(bytes).includes(`hidden="`)

describe("paintReader on the real decks", () => {
  it("lists exactly the shapes readShapes lists, except hidden ones", () => {
    const drift: string[] = []
    let total = 0
    for (const path of decks) {
      const parts = markupParts(path)
      const reader = paintReader(parts)
      const expected = new Map<string, number>()
      const add = (key: string, by: number) => expected.set(key, (expected.get(key) ?? 0) + by)
      for (const row of readShapes(parts)) add(`${row.part}#${row.shape}`, 1)
      for (const { part } of readSlides(parts)) {
        const bytes = parts.get(part)
        if (bytes !== undefined && mayHide(bytes)) for (const id of hiddenRows(bytes)) add(`${part}#${id}`, -1)
        const paint = reader.slide(part)
        if (paint.background?.type === "picture") expect(parts.has(paint.background.part)).toBe(true)
        for (const element of paint.elements) {
          if (element.image !== null)
            expect(parts.has(element.image.part) || addedPicturePart(element.image.part)).toBe(true)
          total += 1
          if (element.from === "slide") add(`${element.part}#${element.shape}`, -1)
        }
      }
      for (const [key, count] of expected) if (count !== 0) drift.push(`${path} ${key} ${count}`)
    }
    expect(drift).toEqual([])
    expect(total).toBeGreaterThan(0)
  }, 30_000)

  it("inherits a title's master geometry and themes a connector's line on real decks", () => {
    const deckAt = (name: string) => markupParts(decks.find((path) => path.endsWith(`/${name}`))!)
    const shapeIn = (name: string, part: string, shape: string) =>
      paintReader(deckAt(name))
        .slide(part)
        .elements.find((element) => element.from === "slide" && element.shape === shape)
    expect(shapeIn("nasa-1d-cnn.pptx", "ppt/slides/slide2.xml", "5")?.geometry).toBe("rect")
    expect(shapeIn("census-updating-spm.pptx", "ppt/slides/slide5.xml", "17")?.line).toMatchObject({
      fill: { type: "solid", color: { hex: "2C567A" } },
      width: 6350,
    })
  })
})

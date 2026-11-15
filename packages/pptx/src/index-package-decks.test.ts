import { expect, it, vi } from "vitest"
import { indexPackage, readParts, readSlides } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"
import { partBytes } from "./part-markup.js"
import { nextShapeId } from "./shape-id.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): readonly string[]
  }
}

const sharing = vi.hoisted(() => ({ on: true }))

vi.mock("./element-span.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./element-span.js")>()
  const { readMarkup } = await import("./markup-reader.js")
  return {
    ...original,
    markupDocument: (bytes: Uint8Array) => (sharing.on ? original.markupDocument(bytes) : readMarkup(bytes, true)),
  }
})

const { readFileSync, readdirSync } = process.getBuiltinModule("node:fs")
const fixtureDir = `${process.cwd()}/scripts/pptx-fixtures`

it("indexes every corpus deck and PowerPoint case as it did when each reader parsed its own copy", async () => {
  const decks = [
    ...readdirSync(fixtureDir).filter((name) => name.endsWith(".pptx")),
    ...readdirSync(`${fixtureDir}/corpus`).map((name) => `corpus/${name}`),
  ]
  expect(decks.length).toBeGreaterThan(40)
  for (const deck of decks) {
    const parts = await readParts(readFileSync(`${fixtureDir}/${deck}`))
    sharing.on = false
    const apart = indexPackage(parts)
    sharing.on = true
    const shared = indexPackage(parts)
    expect(shared, deck).toEqual(apart)
    expect(
      shared.slides.map((slide) => slide.free),
      deck,
    ).toEqual(readSlides(parts).map(({ part }) => nextShapeId(decodeUtf8(partBytes(parts, part)))))
  }
}, 60_000)

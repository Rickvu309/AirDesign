import { expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function deck(name: string): Promise<Map<string, Uint8Array>> {
  const bytes = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)
  return new Map(await readParts(bytes))
}

function body(parts: ReadonlyMap<string, Uint8Array>, part: string) {
  const texts = paintReader(parts)
    .slide(part)
    .elements.flatMap((element) =>
      element.from === "slide" && element.placeholder !== null && element.text != null ? [element.text] : [],
    )
  const found = texts.toSorted((a, b) => b.paragraphs.length - a.paragraphs.length)[0]
  if (found === undefined) throw new Error("body")
  return found
}

it("reads each level's bullet from the placeholder's template", async () => {
  const text = body(await deck("nasa-1d-cnn.pptx"), "ppt/slides/slide2.xml")
  const chars = text.templateBullets
    ?.slice(0, 5)
    .map((bullet) => (bullet !== null && "char" in bullet ? bullet.char : null))
  expect(chars).toEqual(["•", "–", "•", "–", "»"])
})

it("marks only a paragraph whose own properties hold a bullet", async () => {
  const text = body(await deck("nasa-1d-cnn.pptx"), "ppt/slides/slide9.xml")
  expect(text.paragraphs.map((paragraph) => paragraph.ownBullet === true)).toEqual([
    false,
    false,
    false,
    false,
    true,
    false,
  ])
})

it("gives a shape that is not a placeholder no template bullets", async () => {
  const parts = await deck("doe-heat-pumps.pptx")
  const slides = [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  const boxes = slides.flatMap((slide) =>
    paintReader(parts)
      .slide(slide)
      .elements.filter((element) => element.from === "slide" && element.placeholder === null && element.text !== null),
  )
  expect(boxes.length).toBeGreaterThan(0)
  expect(boxes.every((element) => element.text?.templateBullets === undefined)).toBe(true)
})

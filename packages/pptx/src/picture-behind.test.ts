import { describe, expect, it } from "vitest"
import { indexPackage } from "./index-package.js"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { shownSlots } from "./trait-xml-fills.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

const fixtures = `${process.cwd()}/scripts/pptx-fixtures`

const held = [
  ["census-updating-spm.pptx", 1],
  ["doe-heat-pumps.pptx", 3],
  ["nasa-1d-cnn.pptx", 3],
  ["corpus/nasa-earth-gram-rra.pptx", 1],
] as const

const decks = held.map(([name]) => name)

async function deck(name: string): Promise<Parts> {
  return readParts(new Uint8Array(process.getBuiltinModule("node:fs").readFileSync(`${fixtures}/${name}`)))
}

function behindOf(parts: Parts) {
  const slides = new Map(readSlides(parts).map((slide) => [slide.slide, slide.part]))
  return indexPackage(parts).elements.flatMap((element) => {
    const [slide = "", shape = ""] = element.node.split(".")
    const part = slides.get(slide)
    if (part === undefined || element.kind !== "shape") return []
    const at = { slide, part, shape }
    const [bottom, top] = shownSlots(parts, at)
    return bottom !== null &&
      bottom !== undefined &&
      "solid" in bottom &&
      top !== undefined &&
      top !== null &&
      "image" in top
      ? [{ node: element.node, at }]
      : []
  })
}

describe("a picture with a solid behind its image stays a native p:pic", () => {
  const opened = new Map<string, Parts>()
  const found: { readonly name: string; readonly behind: ReturnType<typeof behindOf> }[] = []

  it("finds the eight slide pictures with a solid behind their image, all in these four decks", async () => {
    for (const name of decks) {
      const parts = await deck(name)
      opened.set(name, parts)
      found.push({ name, behind: behindOf(parts) })
    }
    expect(found.map(({ name, behind }) => [name, behind.length])).toEqual(held)
  })
})

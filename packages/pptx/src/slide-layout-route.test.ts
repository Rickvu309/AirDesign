declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { orderKeyAfter, presentSlides, slideId, type SlideCommand } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { deckLayouts } from "./deck-layouts.js"
import { readSections } from "./section-read.js"
import { layoutPart } from "./slide-placeholders.js"
import { slideAddresses } from "./package-address.js"
import { readParts } from "./package-container.js"
import { orderedParts } from "./slide-order-route.js"
import { decodeUtf8 } from "./package-bytes.js"

const folder = `${process.cwd()}/scripts/pptx-fixtures`

async function deck(name: string) {
  return readParts(readFileSync(`${folder}/${name}`))
}

function added(file: ReturnType<typeof slideId>[], after: string, layout: string, layoutPart?: string): SlideCommand {
  const key = orderKeyAfter(presentSlides({ file, order: [] }), slideId(after))
  if (key === null) throw new Error("key")
  const id = slideId(String(Math.max(...file.map(Number)) + 1))
  return {
    slide: "add",
    id,
    after: slideId(after),
    key,
    layout: slideId(layout),
    ...(layoutPart === undefined ? {} : { layoutPart }),
  }
}

function newSlide(parts: ReadonlyMap<string, Uint8Array>, before: ReadonlyMap<string, Uint8Array>) {
  const known = new Set(slideAddresses(before).map((address) => address.part))
  const part = slideAddresses(parts).find((address) => !known.has(address.part))?.part
  if (part === undefined) throw new Error("slide")
  return part
}

describe("a slide added from a layout", () => {
  it("points at the layout part it was added with and carries that layout's placeholders", async () => {
    const original = await deck("blank.pptx")
    const file = [slideId("256")]
    const command = added(file, "256", "256", "ppt/slideLayouts/slideLayout4.xml")
    const exported = orderedParts(original, { file, order: [command] })
    const part = newSlide(exported, original)
    expect(layoutPart(exported, part)).toBe("ppt/slideLayouts/slideLayout4.xml")
    const xml = decodeUtf8(exported.get(part) ?? new Uint8Array())
    expect(xml.match(/<p:ph /g)).toHaveLength(3)
    expect(xml).toContain('idx="2"')
    for (const [name, bytes] of original) {
      if (!name.startsWith("ppt/slideLayouts/") && !name.startsWith("ppt/slides/")) continue
      expect(exported.get(name)).toEqual(bytes)
    }
  })

  it("points at the layout of the slide it names, not the layout of the slide it follows", async () => {
    const original = await deck("nasa-1d-cnn.pptx")
    const addresses = slideAddresses(original)
    const layouts = addresses.map((address) => layoutPart(original, address.part))
    const other = layouts.findIndex((layout) => layout !== layouts[0])
    const first = addresses[0]
    const named = addresses[other]
    if (first === undefined || named === undefined) throw new Error("slide")
    const file = addresses.map((address) => slideId(address.slide))
    const command = added(file, first.slide, named.slide)
    const exported = orderedParts(original, { file, order: [command] })
    const part = newSlide(exported, original)
    expect(layoutPart(exported, part)).toBe(layouts[other])
    expect(layoutPart(exported, part)).not.toBe(layouts[0])
  })

  it("puts a slide added from a layout in the section of the slide it follows", async () => {
    const original = await deck("sections-before.pptx")
    const file = [slideId("256"), slideId("257")]
    const part = deckLayouts(original)[0]?.part
    const command = added(file, "257", "256", part)
    const exported = orderedParts(original, { file, order: [command] })
    expect(readSections(exported)).toEqual([
      { name: "Opening", slides: ["256"] },
      { name: "Numbers", slides: ["257", "258"] },
    ])
  })

  it("falls back to the named slide's layout when the part is not a layout of the deck", async () => {
    const original = await deck("blank.pptx")
    const file = [slideId("256")]
    const command = added(file, "256", "256", "ppt/slides/slide1.xml")
    const exported = orderedParts(original, { file, order: [command] })
    expect(layoutPart(exported, newSlide(exported, original))).toBe("ppt/slideLayouts/slideLayout1.xml")
  })
})

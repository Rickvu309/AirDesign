declare const process: { cwd(): string; getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array } }
import { orderKeyBetween, slideId, type SlideCommand, type SlideState } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { orderedParts, paintReader, readParts, readSlides } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

const { readFileSync } = process.getBuiltinModule("node:fs")
const fixture = (name: string) => readParts(readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
const text = (bytes: Uint8Array | undefined) => (bytes === undefined ? "" : decodeUtf8(bytes))
const accent = { scheme: "accent1" } as const
const navy = { rgb: "0F2433" } as const
const written = (val: string) => `<p:bg><p:bgPr><a:solidFill>${val}</a:solidFill><a:effectLst/></p:bgPr></p:bg>`

function stateOf(parts: ReadonlyMap<string, Uint8Array>, order: readonly SlideCommand[]): SlideState {
  return { file: readSlides(parts).map((each) => slideId(each.slide)), order }
}

function changedParts(before: ReadonlyMap<string, Uint8Array>, after: ReadonlyMap<string, Uint8Array>): string[] {
  const names = new Set([...before.keys(), ...after.keys()])
  return [...names].filter((name) => before.get(name) !== after.get(name)).sort()
}

function shown(parts: ReadonlyMap<string, Uint8Array>, part: string) {
  return paintReader(parts).slide(part).background
}

describe("slide background", () => {
  it("writes a theme colour as the first child of the slide's cSld, and changes no other part", async () => {
    const parts = await fixture("blank.pptx")
    const [first] = readSlides(parts)
    if (first === undefined) throw new Error("slide")
    const id = slideId(first.slide)
    const next = orderedParts(parts, stateOf(parts, [{ slide: "background", id, color: accent }]))
    expect(changedParts(parts, next)).toEqual([first.part])
    expect(text(next.get(first.part))).toContain(`<p:cSld>${written('<a:schemeClr val="accent1"/>')}<p:spTree>`)
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "505050", alpha: 1 } })
  })

  it("replaces the slide's own background with an RGB colour and keeps the rest of the slide's bytes", async () => {
    const parts = await fixture("nasa-1d-cnn.pptx")
    const [first] = readSlides(parts)
    if (first === undefined) throw new Error("slide")
    const before = text(parts.get(first.part))
    const own = /<p:bg>.*?<\/p:bg>/.exec(before)?.[0]
    if (own === undefined) throw new Error("background")
    const next = orderedParts(parts, stateOf(parts, [{ slide: "background", id: slideId(first.slide), color: navy }]))
    expect(text(next.get(first.part))).toBe(before.replace(own, written('<a:srgbClr val="0F2433"/>')))
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
  })

  it("keeps the file's bytes when the last command gives the slide back its own background", async () => {
    const parts = await fixture("nasa-1d-cnn.pptx")
    const id = slideId(readSlides(parts)[0]!.slide)
    const state = stateOf(parts, [
      { slide: "background", id, color: navy },
      { slide: "background", id, color: null },
    ])
    expect(changedParts(parts, orderedParts(parts, state))).toEqual([])
  })

  it("gives a duplicate the colour its source had, and later colours stay on their own slide", async () => {
    const parts = await fixture("blank.pptx")
    const [first] = readSlides(parts)
    if (first === undefined) throw new Error("slide")
    const id = slideId(first.slide)
    const copy = slideId("900")
    const state = stateOf(parts, [
      { slide: "background", id, color: navy },
      { slide: "clone", id: copy, source: id, key: orderKeyBetween(null, null) },
      { slide: "background", id, color: accent },
    ])
    const next = orderedParts(parts, state)
    const slides = readSlides(next)
    const cloned = slides.find(
      (each) => each.part !== first.part && !readSlides(parts).some((was) => was.part === each.part),
    )
    if (cloned === undefined) throw new Error("clone")
    expect(shown(next, first.part)).toEqual({ type: "solid", color: { hex: "505050", alpha: 1 } })
    expect(shown(next, cloned.part)).toEqual({ type: "solid", color: { hex: "0F2433", alpha: 1 } })
  })
})

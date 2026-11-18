declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const { readFileSync } = process.getBuiltinModule("node:fs")
import { slideId, slidesKept, type SlideState } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportPackage } from "./export-package.js"
import { slideAddresses } from "./package-address.js"
import { readParts } from "./package-container.js"
import { readPackage } from "./package-limits.js"
import { readSections } from "./section-read.js"
import { orderedParts } from "./slide-order-route.js"

const folder = `${process.cwd()}/scripts/pptx-fixtures`

async function opened(name: string) {
  const bytes = readFileSync(`${folder}/${name}`)
  const parts = await readParts(bytes)
  const state: SlideState = { file: slideAddresses(parts).map((address) => slideId(address.slide)), order: [] }
  return { bytes, parts, state }
}

async function exported(bytes: Uint8Array, parts: ReadonlyMap<string, Uint8Array>) {
  const read = await readPackage(await exportPackage(bytes, parts))
  if (!read.ok) throw new Error(read.reason)
  return read.parts
}

describe("exporting the chosen slides", () => {
  it("writes only the chosen slide of an imported deck, byte for byte, with no part left pointing at a removed slide", async () => {
    const deck = await opened("doe-heat-pumps.pptx")
    const chosen = slideAddresses(deck.parts)[6]
    if (chosen === undefined) throw new Error("slide")
    const parts = await exported(deck.bytes, orderedParts(deck.parts, slidesKept(deck.state, [6])))
    expect(slideAddresses(parts).map((address) => address.part)).toEqual([chosen.part])
    expect(parts.get(chosen.part)).toEqual(deck.parts.get(chosen.part))
    const removed = slideAddresses(deck.parts).filter((address) => address.part !== chosen.part)
    for (const address of removed) expect(parts.has(address.part)).toBe(false)
  })

  it("keeps each section that holds a chosen slide, with only its chosen slides", async () => {
    const deck = await opened("sections-before.pptx")
    const parts = await exported(deck.bytes, orderedParts(deck.parts, slidesKept(deck.state, [1])))
    expect(slideAddresses(parts).map((address) => address.slide)).toEqual(["257"])
    expect(readSections(parts)).toEqual([{ name: "Numbers", slides: ["257"] }])
  })

  it("leaves the blank deck's one slide untouched", async () => {
    const deck = await opened("blank.pptx")
    expect(orderedParts(deck.parts, slidesKept(deck.state, [0]))).toBe(deck.parts)
  })
})

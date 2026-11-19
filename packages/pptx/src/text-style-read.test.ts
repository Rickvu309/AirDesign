import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"
import { shownTextStyle } from "./text-style-read.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

type Parts = ReadonlyMap<string, Uint8Array>

async function deck(name: string): Promise<Parts> {
  const fs = process.getBuiltinModule("node:fs")
  return readParts(new Uint8Array(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`)))
}

function at(parts: Parts, slide: number, shape: string) {
  const part = readSlides(parts)[slide - 1]?.part
  if (part === undefined) throw new Error("slide")
  return { part, shape }
}

describe("shownTextStyle", () => {
  it("reads a title's size, font and spacing from its layout and master, none of them its own", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    expect(shownTextStyle(parts, at(parts, 12, "2"))).toEqual({
      fill: { value: { solid: { scheme: "tx1" } }, own: false },
      size: { value: 4400, own: false },
      font: { value: "Calibri Light", own: false },
      align: { value: "left", own: false },
      case: { value: "none", own: false },
      strike: { value: false, own: false },
      letterSpacing: { value: 0, own: false },
      list: { value: "none", own: false },
      lineHeight: { value: 90_000, own: false },
      spaceBefore: { value: 0, own: false },
      spaceAfter: { value: 0, own: false },
    })
  })

  it("names the size and font a run sets as its own", async () => {
    const parts = await deck("doe-heat-pumps.pptx")
    const shown = shownTextStyle(parts, at(parts, 1, "2"))
    expect(shown?.size).toEqual({ value: 3600, own: true })
    expect(shown?.font).toEqual({ value: "Abadi", own: true })
    expect(shown?.lineHeight).toEqual({ value: 90_000, own: false })
  })

  it("reads what paints when the deck sets no text style: 18 pt in the theme's body font, single spacing", async () => {
    const parts = await deck("clean.pptx")
    expect(shownTextStyle(parts, at(parts, 1, "2"))).toEqual({
      fill: { value: { solid: { scheme: "dk1" } }, own: true },
      size: { value: 3200, own: true },
      font: { value: "Arial", own: false },
      align: { value: "left", own: false },
      case: { value: "none", own: false },
      strike: { value: false, own: false },
      letterSpacing: { value: 0, own: false },
      list: { value: "none", own: false },
      lineHeight: { value: 100_000, own: false },
      spaceBefore: { value: 0, own: false },
      spaceAfter: { value: 0, own: false },
    })
  })
})

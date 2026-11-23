import { describe, expect, it } from "vitest"
import { indexPackage } from "./index-package.js"
import { shownBody } from "./body-read.js"
import { readParts } from "./package-container.js"
import { readSlides } from "./read-shapes.js"

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
  const read = readSlides(parts)[slide - 1]
  if (read === undefined) throw new Error("slide")
  const element = indexPackage(parts).elements.find((each) => each.node === `${read.slide}.${shape}`)
  if (element === undefined) throw new Error("element")
  return { node: element.node, part: read.part, shape }
}

describe("exportParts on a text box's body", () => {
  it("reads what an empty body shows from PowerPoint's own defaults", async () => {
    const parts = await deck("clean.pptx")
    expect(shownBody(parts, at(parts, 1, "2"))).toEqual({
      insets: { value: { left: 91440, top: 45720, right: 91440, bottom: 45720 }, own: false },
      anchor: { value: "t", own: false },
      wrap: { value: true, own: false },
      autofit: { value: "none", own: false },
      vertical: { value: "horz", own: false },
      columns: { value: 1, own: false },
    })
  })
})

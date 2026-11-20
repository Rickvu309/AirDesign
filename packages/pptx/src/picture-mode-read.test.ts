import { elementId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readParts } from "./package-container.js"
import { readTraits } from "./trait-read.js"
import { writeTrait } from "./trait-xml.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const at = { slide: "256", part: "ppt/slides/slide1.xml", shape: "4" }

async function deck(): Promise<Map<string, Uint8Array>> {
  const fs = process.getBuiltinModule("node:fs")
  const bytes = fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/picture-png.pptx`)
  return new Map(await readParts(new Uint8Array(bytes)))
}

function readsOf(parts: ReadonlyMap<string, Uint8Array>) {
  return readTraits(parts).elements.get(elementId("256.4"))?.reads
}

describe("an image's fill mode in the reads an agent's design line comes from", () => {
  it("names the mode the file holds, and leaves Stretch unsaid", async () => {
    const parts = await deck()
    for (const mode of ["fit", "crop", "tile", "fill"] as const) {
      const next = writeTrait(parts, at, "fills", { mode: { set: mode } })
      expect(readsOf(next)?.["fills.mode"]).toEqual({ value: mode })
    }
    const stretched = writeTrait(parts, at, "fills", { mode: { set: "stretch" } })
    expect(readsOf(stretched)?.["fills.mode"]).toBeUndefined()
    expect(readsOf(stretched)?.fills).toEqual({ value: "image" })
  })
})

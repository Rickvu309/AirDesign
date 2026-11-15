import { readParts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { firstSlideOf } from "@/decks/first-slide"

async function fixture(name: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  return readParts(await fs.readFile(new URL(`../../../../scripts/pptx-fixtures/${name}`, import.meta.url)))
}

it("paints the first slide of a deck from the parts this device keeps", async () => {
  const painted = firstSlideOf(await fixture("clean.pptx"), null)
  expect(painted?.slide.width).toBeGreaterThan(0)
  expect(painted?.slide.elements.length).toBeGreaterThan(0)
  painted?.release()
})

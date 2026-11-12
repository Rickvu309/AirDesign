import { readPackage } from "@airdesign/pptx"
import { beforeAll, expect, it } from "vitest"
import { ensureMarkup } from "./markup"
import { indexedParts } from "./index-deck"
import { onSlide, twoBoxSlide, xml } from "./slide-fixtures"

beforeAll(ensureMarkup)
it("indexes layout placeholders on the device without copying the slide text", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/blank.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const index = indexedParts(read.parts)
  expect(index.slides[0]?.layout?.map((row) => row.node)).toEqual(["256.2", "256.3"])
  expect(index.slides[0]?.layout?.every((row) => !row.value?.includes("Hello"))).toBe(true)
})
it("keeps a readable deck index when its parts cannot create a layout slide", () => {
  const index = indexedParts(onSlide(xml(twoBoxSlide)))
  expect(index.elements.map((row) => row.node)).toEqual(["256.2", "256.3"])
  expect(index.slides[0]?.layout).toBeUndefined()
})

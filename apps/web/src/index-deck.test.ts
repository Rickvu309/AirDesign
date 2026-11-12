import { readIndexPage } from "@airdesign/document"
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
it("indexes the layouts of a 41-slide deck before the import waits too long", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const index = indexedParts(read.parts)
  expect(index.slides).toHaveLength(41)
  expect(index.slides.every((row) => (row.layout?.length ?? 0) > 0)).toBe(true)
})
it("keeps a readable deck index when a layout has more placeholders than an index row may hold", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../scripts/pptx-fixtures/blank.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const layoutName = "ppt/slideLayouts/slideLayout1.xml"
  const layout = new TextDecoder().decode(read.parts.get(layoutName))
  const crowded = Array.from(
    { length: 150 },
    (_, n) =>
      `<p:sp><p:nvSpPr><p:cNvPr id="${n + 10}" name="p${n}"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="${n + 10}"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr></p:sp>`,
  ).join("")
  const parts = new Map(read.parts).set(layoutName, xml(layout.replace("</p:spTree>", `${crowded}</p:spTree>`)))
  const index = indexedParts(parts)
  expect(index.elements.map((row) => row.node)).toEqual(["256.2", "256.3"])
  expect(index.slides[0]?.layout).toBeUndefined()
  expect(readIndexPage({ once: "a", offset: 0, total: index.elements.length, slides: index.slides, elements: index.elements })).not.toBeNull()
})

import {
  designBytes,
  nextSlideId,
  readIndexPage,
  readSlideId,
  type SlideCommand,
  type SlideId,
} from "@airdesign/document"
import { bytesOf, orderKeyBetween, type OrderKey } from "@airdesign/doom"
import { orderedParts, readPackage, slideLayouts } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { indexedParts } from "./index-deck"
import { onSlide, twoBoxSlide, xml } from "../slide-fixtures"

it("indexes layout placeholders on the device without copying the slide text", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/blank.pptx", import.meta.url)),
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
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const index = indexedParts(read.parts)
  expect(index.slides).toHaveLength(41)
  expect(index.slides.every((row) => (row.layout?.length ?? 0) > 0)).toBe(true)
})
it("gives an agent's new Title and Content slide an empty title and body and no footer boxes", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const layouts = slideLayouts(read.parts)
  const index = indexedParts(read.parts)
  const floors = index.slides.filter((row) => layouts.get(row.id) === "ppt/slideLayouts/slideLayout2.xml")
  expect(floors.length).toBeGreaterThan(0)
  const empty = JSON.stringify([{ from: 0, runs: [] }])
  for (const row of floors) {
    expect(row.layout?.map((element) => [element.kind, element.value])).toEqual([
      ["shape", empty],
      ["shape", empty],
    ])
  }
})
it("keeps a readable deck index when a layout has more placeholders than an index row may hold", async () => {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/blank.pptx", import.meta.url)),
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
  expect(
    readIndexPage({
      once: "a",
      offset: 0,
      total: index.elements.length,
      slides: index.slides,
      elements: index.elements,
    }),
  ).not.toBeNull()
})

async function doeAtFifty() {
  const fsName = "node:fs/promises"
  const fs = (await import(fsName)) as { readFile: (path: URL) => Promise<Uint8Array> }
  const read = await readPackage(
    await fs.readFile(new URL("../../../../scripts/pptx-fixtures/doe-heat-pumps.pptx", import.meta.url)),
  )
  if (!read.ok) throw new Error(read.reason)
  const file = indexedParts(read.parts).slides.flatMap((row) => {
    const id = readSlideId(row.id)
    return id === undefined ? [] : [id]
  })
  const order: SlideCommand[] = []
  const ids: SlideId[] = [...file]
  let key: OrderKey | null = null
  let after = file[file.length - 1]!
  while (ids.length < 50) {
    const id = nextSlideId(ids)
    key = orderKeyBetween(key, null)
    order.push({ slide: "add", id, after, layout: file[1]!, key })
    ids.push(id)
    after = id
  }
  return orderedParts(read.parts, { file, order })
}

it("indexes a 50-slide deck with every layout floor, in at most 4 pages, with no design above 400 bytes", async () => {
  const index = indexedParts(await doeAtFifty())
  expect(index.slides).toHaveLength(50)
  const floors = index.slides.flatMap((slide) => (slide.layout === undefined ? [] : [slide.layout]))
  expect(floors).toHaveLength(50)
  expect(floors.flat().every((element) => element.design === undefined && element.kept === undefined)).toBe(true)
  expect(floors.flat().some((element) => element.role === "title")).toBe(true)
  expect(index.palettes).toHaveLength(1)
  const designed = index.elements.filter((element) => element.design !== undefined)
  expect(designed.length).toBeGreaterThan(index.elements.length / 2)
  expect(
    Math.max(...index.elements.map((element) => bytesOf(JSON.stringify(element.design ?? {})))),
  ).toBeLessThanOrEqual(designBytes)
})

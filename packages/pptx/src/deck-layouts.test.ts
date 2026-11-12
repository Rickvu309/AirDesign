import { expect, it } from "vitest"
import { deckLayouts, readPackage } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function fixture(name: string) {
  const read = await readPackage(
    process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`),
  )
  if (!read.ok) throw new Error(name)
  return read.parts
}

it("lists the layouts of the blank deck in the order its master gives them, with the names the file holds", async () => {
  expect(deckLayouts(await fixture("blank.pptx"))).toEqual([
    { part: "ppt/slideLayouts/slideLayout1.xml", name: "Title Slide", type: "title" },
    { part: "ppt/slideLayouts/slideLayout2.xml", name: "Title and Content", type: "obj" },
    { part: "ppt/slideLayouts/slideLayout3.xml", name: "Section Header", type: "secHead" },
    { part: "ppt/slideLayouts/slideLayout4.xml", name: "Two Content", type: "twoObj" },
    { part: "ppt/slideLayouts/slideLayout5.xml", name: "Title Only", type: "titleOnly" },
    { part: "ppt/slideLayouts/slideLayout6.xml", name: "Blank", type: "blank" },
  ])
})

it("lists every layout of an imported deck, including layouts no slide uses", async () => {
  const parts = await fixture("nasa-1d-cnn.pptx")
  const layouts = deckLayouts(parts)
  expect(layouts).toHaveLength(10)
  for (const layout of layouts) {
    expect(parts.has(layout.part)).toBe(true)
    expect(layout.name.length).toBeGreaterThan(0)
  }
})

it("lists no layout for a package whose master is missing", async () => {
  const parts = new Map(await fixture("blank.pptx"))
  parts.delete("ppt/slideMasters/slideMaster1.xml")
  expect(deckLayouts(parts)).toEqual([])
})

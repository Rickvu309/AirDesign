import { expect, it } from "vitest"
import { readPackage, slideLayouts } from "./index.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

async function fixture(name: string) {
  const read = await readPackage(process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
  if (!read.ok) throw new Error(name)
  return read.parts
}

it("names the layout part of every slide, shared between slides that use the same layout", async () => {
  const layouts = slideLayouts(await fixture("doe-heat-pumps.pptx"))
  expect(layouts.size).toBe(41)
  expect(new Set(layouts.values()).size).toBeLessThan(10)
  for (const part of layouts.values()) expect(part).toMatch(/^ppt\/slideLayouts\/slideLayout\d+\.xml$/)
})

it("leaves out a slide whose layout cannot be found", async () => {
  const parts = new Map(await fixture("blank.pptx"))
  parts.delete("ppt/slides/_rels/slide1.xml.rels")
  expect(slideLayouts(parts).size).toBe(0)
})

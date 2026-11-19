import { readPackage } from "@airdesign/pptx"
import { expect, it } from "vitest"
import { layerPairs, showsIn } from "./slide-shows"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

it("lines the file's hidden slides and transitions up with the deck's slides", async () => {
  const bytes = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const read = await readPackage(bytes)
  if (!read.ok) throw new Error("blank")
  const part = "ppt/slides/slide1.xml"
  const xml = new TextDecoder()
    .decode(read.parts.get(part))
    .replace(/<p:sld\b/, '<p:sld show="0"')
    .replace("</p:sld>", "<p:transition><p:fade/></p:transition></p:sld>")
  const parts = new Map(read.parts).set(part, new TextEncoder().encode(xml))
  const id = new TextDecoder().decode(parts.get("ppt/presentation.xml")).match(/<p:sldId id="(\d+)"/)?.[1]
  expect(showsIn(parts, [id, "added", undefined])).toEqual([
    { hidden: true, transition: { kind: "fade", direction: null, duration: 500 }, advance: null },
    { hidden: false, transition: null, advance: null },
    { hidden: false, transition: null, advance: null },
  ])
})

it("names the matched layers of two slides by the slide each sits on", async () => {
  const bytes = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const read = await readPackage(bytes)
  if (!read.ok) throw new Error("blank")
  const part = "ppt/slides/slide1.xml"
  const xml = new TextDecoder().decode(read.parts.get(part))
  const id = new TextDecoder().decode(read.parts.get("ppt/presentation.xml")).match(/<p:sldId id="(\d+)"/)?.[1]
  const named = [...xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]+)"/g)].map((match) => match[1])
  expect(named.length).toBeGreaterThan(0)
  expect(layerPairs(read.parts, id, id)).toEqual(
    named.map((shape) => [`${String(id)}.${shape}`, `${String(id)}.${shape}`]),
  )
  expect(layerPairs(read.parts, id, "gone")).toEqual([])
})

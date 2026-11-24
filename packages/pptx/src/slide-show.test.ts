import { expect, it } from "vitest"
import { applyRoute, exportPackage, readPackage } from "./index.js"
import { decodeUtf8, encodeUtf8 as encode } from "./package-bytes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

it("keeps a hidden slide hidden and its transition through an edit and an export", async () => {
  const original = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const read = await readPackage(original)
  if (!read.ok) throw new Error("blank")
  const part = "ppt/slides/slide1.xml"
  const xml = decodeUtf8(read.parts.get(part)!)
    .replace(/<p:sld\b/, '<p:sld show="0"')
    .replace("</p:sld>", '<p:transition spd="med"><p:push dir="r"/></p:transition></p:sld>')
  const parts = new Map(read.parts).set(part, encode(xml))
  const value = [{ from: 0, runs: [{ from: -1, text: "Hidden but kept" }] }]
  const written = applyRoute(parts, { name: "text", part, shape: "2", value })
  const exported = await readPackage(await exportPackage(original, written))
  if (!exported.ok) throw new Error("export")
  expect(exported.parts.get(part)).toEqual(written.get(part))
  expect(decodeUtf8(exported.parts.get(part)!)).toContain('show="0"')
})

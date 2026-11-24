import { expect, it } from "vitest"
import { applyRoute, exportPackage, indexPackage, readPackage, readShapes, readSlides } from "./index.js"
import { paintReader } from "./paint-reader.js"
import { decodeUtf8 } from "./package-bytes.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

it("reads the blank original's layouts and empty editable title and preserves untouched parts", async () => {
  const original = process.getBuiltinModule("node:fs").readFileSync(`${process.cwd()}/scripts/pptx-fixtures/blank.pptx`)
  const read = await readPackage(original)
  expect(read.ok).toBe(true)
  if (!read.ok) throw new Error("blank original")
  const { parts } = read
  expect([...(await exportPackage(original, parts))]).toEqual([...original])
  expect(readSlides(parts)).toEqual([{ slide: "256", part: "ppt/slides/slide1.xml" }])
  const layouts = [...parts].filter(([name]) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name))
  expect(layouts.map(([, bytes]) => decodeUtf8(bytes).match(/<p:cSld name="([^"]+)"/)?.[1])).toEqual([
    "Title Slide",
    "Title and Content",
    "Section Header",
    "Two Content",
    "Title Only",
    "Blank",
  ])
  expect(
    layouts.map(([, bytes]) =>
      [...decodeUtf8(bytes).matchAll(/<p:ph type="([^"]+)" idx="(\d+)"/g)].map((match) => `${match[1]}:${match[2]}`),
    ),
  ).toEqual([
    ["ctrTitle:0", "subTitle:1"],
    ["title:0", "obj:1"],
    ["title:0", "body:1"],
    ["title:0", "obj:1", "obj:2"],
    ["title:0"],
    [],
  ])
  expect([...parts.keys()].filter((name) => /^ppt\/slideMasters\/[^/]+\.xml$/.test(name))).toHaveLength(1)
  expect([...parts.keys()].some((name) => /^(docProps\/|ppt\/(media|fonts)\/)/.test(name))).toBe(false)
  expect(parts.has("ppt/presProps.xml")).toBe(true)
  const slide = paintReader(parts).slide("ppt/slides/slide1.xml")
  expect([slide.width, slide.height]).toEqual([12192000, 6858000])
  expect(slide.elements.map((element) => element.placeholder?.type)).toEqual(["ctrTitle", "subTitle"])
  expect(slide.elements.every((element) => element.box !== null && element.text !== null)).toBe(true)
  const shapes = readShapes(parts)
  expect(shapes).toHaveLength(2)
  expect(shapes.every((shape) => !shape.locked && shape.text.length === 1)).toBe(true)
  expect(indexPackage(parts).elements).toHaveLength(2)
  const value = [{ from: 0, runs: [{ from: -1, text: "My first deck" }] }]
  const written = applyRoute(parts, { name: "text", part: "ppt/slides/slide1.xml", shape: "2", value })
  expect(readShapes(written)[0]?.text[0]?.runs[0]?.text).toBe("My first deck")
  const exported = await readPackage(await exportPackage(original, written))
  if (!exported.ok) throw new Error("blank export")
  expect([...exported.parts.keys()]).toEqual([...parts.keys()])
  for (const [name, bytes] of parts) {
    if (name !== "ppt/slides/slide1.xml") expect(exported.parts.get(name), name).toEqual(bytes)
  }
})

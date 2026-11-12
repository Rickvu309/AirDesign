import type { TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { markupDocument } from "./element-span.js"
import { routeRuns, touchMatches } from "./index.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, shapeTextValue } from "./text-value-route.js"

const part = "ppt/slides/slide1.xml"
const body =
  '<a:p><a:r><a:rPr lang="en-US"/><a:t>First line</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US"/><a:t>Second line</a:t></a:r></a:p>'
const parts = new Map([
  [
    "ppt/presentation.xml",
    encodeUtf8('<p:presentation><p:sldIdLst><p:sldId id="256" r:id="r1"/></p:sldIdLst></p:presentation>'),
  ],
  [
    "ppt/_rels/presentation.xml.rels",
    encodeUtf8('<Relationships><Relationship Id="r1" Type="x/slide" Target="slides/slide1.xml"/></Relationships>'),
  ],
  [
    part,
    encodeUtf8(
      `<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="S"/></p:nvSpPr><p:txBody><a:bodyPr/>${body}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
    ),
  ],
])

function written(operation: string): string {
  const run = routeRuns(parts).find((each) => each.operation === operation)
  expect(run?.error).toBeNull()
  expect(run?.touch).toEqual({ changed: [part], added: [], removed: [] })
  const bytes = run?.parts?.get(part)
  if (bytes === undefined) throw new Error(operation)
  return decodeUtf8(bytes)
}

it("judges a format on every run of a box", () => {
  expect(written("text.format")).toContain('<a:rPr lang="en-US" b="1" i="0" u="sng"/><a:t>First line</a:t>')
})

it("judges a format on a range that starts and ends inside one run", () => {
  expect(written("text.format.range")).toContain(
    '<a:r><a:rPr lang="en-US"/><a:t>F</a:t></a:r><a:r><a:rPr lang="en-US" b="1"/><a:t>irst lin</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t>e</a:t></a:r>',
  )
})

it("judges a format on a range that spans two paragraphs", () => {
  const xml = written("text.format.paragraphs")
  expect(xml).toContain('<a:t>F</a:t></a:r><a:r><a:rPr lang="en-US" i="1" u="sng"/><a:t>irst line</a:t>')
  expect(xml).toContain(
    '<a:r><a:rPr lang="en-US" i="1" u="sng"/><a:t>S</a:t></a:r><a:r><a:rPr lang="en-US"/><a:t>econd line</a:t>',
  )
})

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const realDecks = ["census-updating-spm.pptx", "doe-heat-pumps.pptx", "nasa-1d-cnn.pptx"]

function paragraphTexts(value: TextValue): readonly string[] {
  return value.map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
}

it("formats text on real decks inside its own shape's text and keeps every paragraph's text", async () => {
  const fs = process.getBuiltinModule("node:fs")
  for (const name of realDecks) {
    const deck = await readParts(fs.readFileSync(`${process.cwd()}/scripts/pptx-fixtures/${name}`))
    const runs = routeRuns(deck).filter((run) => run.operation.startsWith("text.format"))
    expect(runs.map((run) => run.operation)).toEqual(["text.format", "text.format.range", "text.format.paragraphs"])
    for (const run of runs) {
      if (run.edit?.name !== "text" || run.parts === null) throw new Error(run.error ?? run.operation)
      const before = partOf(deck, run.edit.part)
      const after = partOf(run.parts, run.edit.part)
      const old = bodyOf(before, run.edit.shape)
      const next = bodyOf(after, run.edit.shape)
      expect(after.subarray(0, next.start)).toEqual(before.subarray(0, old.start))
      expect(after.subarray(next.end)).toEqual(before.subarray(old.end))
      expect(paragraphTexts(next.value)).toEqual(paragraphTexts(old.value))
      expect(touchMatches(deck, run.parts, run.touch ?? { changed: [], added: [], removed: [] })).toBe(true)
    }
  }
}, 30_000)

function partOf(parts: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return bytes
}

function bodyOf(bytes: Uint8Array, id: string) {
  const elements = markupDocument(bytes).elements
  const children = markupChildren(elements)
  const shape = shapeById(elements, id)
  const body = children[shape.index]?.find((element) => element.kind === "p:txBody")
  if (body === undefined) throw new Error("body")
  return { start: body.start, end: body.end, value: shapeTextValue(children, bytes, shape) }
}

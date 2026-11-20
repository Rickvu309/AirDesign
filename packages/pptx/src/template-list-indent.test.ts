import type { TextValue } from "@airdesign/document"
import { expect, it } from "vitest"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { paintReader } from "./paint-reader.js"
import { readShapes } from "./read-shapes.js"
import { applyRoute } from "./slide-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string): Uint8Array }
}

const part = "ppt/slides/slide16.xml"

async function heatPumps(): Promise<Map<string, Uint8Array>> {
  const bytes = process
    .getBuiltinModule("node:fs")
    .readFileSync(`${process.cwd()}/scripts/pptx-fixtures/doe-heat-pumps.pptx`)
  return new Map(await readParts(bytes))
}

function bodyText(parts: ReadonlyMap<string, Uint8Array>): TextValue {
  const found = readShapes(parts).find((row) => row.part === part && row.shape === "3")
  if (found === undefined) throw new Error("body")
  return found.text
}

function tabbed(value: TextValue, word: string, level: number): TextValue {
  return value.map((paragraph) =>
    paragraph.runs.some((run) => run.text === word) ? { ...paragraph, level } : paragraph,
  )
}

function written(parts: ReadonlyMap<string, Uint8Array>, value: TextValue): string {
  const after = applyRoute(parts, { name: "text", part, shape: "3", value }).get(part)
  if (after === undefined) throw new Error("part")
  return decodeUtf8(after)
}

it("reads each level's indent from the placeholder's template", async () => {
  const body = paintReader(await heatPumps())
    .slide(part)
    .elements.find((element) => element.shape === "3")
  expect(body?.text?.templateIndents?.slice(0, 3)).toEqual([
    { marginLeft: 228600, indent: -228600 },
    { marginLeft: 685800, indent: -228600 },
    { marginLeft: 1143000, indent: -228600 },
  ])
})

it("gives a shape that is not a placeholder no template indents", async () => {
  const parts = await heatPumps()
  const slides = [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
  const boxes = slides.flatMap((slide) =>
    paintReader(parts)
      .slide(slide)
      .elements.filter((element) => element.from === "slide" && element.placeholder === null && element.text !== null),
  )
  expect(boxes.length).toBeGreaterThan(0)
  expect(boxes.every((element) => element.text?.templateIndents === undefined)).toBe(true)
})

it("tabs an item in a placeholder to its template's level and writes only lvl", async () => {
  const parts = await heatPumps()
  const before = decodeUtf8(parts.get(part) ?? encodeUtf8(""))
  const after = written(parts, tabbed(bodyText(parts), "NCCER", 2))
  expect(after).toBe(
    before.replace(
      '<a:p><a:pPr lvl="1"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>NCCER',
      '<a:p><a:pPr lvl="2"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>NCCER',
    ),
  )
})

it("drops a file's own indent when an item moves to a level its template sets", async () => {
  const parts = await heatPumps()
  const after = written(parts, tabbed(bodyText(parts), "HVAC Core and Specialty", 2))
  expect(after).toContain(
    '<a:pPr lvl="2"><a:buAutoNum type="romanLcPeriod"/></a:pPr><a:r><a:rPr lang="en-US" dirty="0"/><a:t>HVAC Core and Specialty',
  )
})

it("keeps every byte when an item goes back to its own level", async () => {
  const parts = await heatPumps()
  expect(written(parts, bodyText(parts))).toBe(decodeUtf8(parts.get(part) ?? encodeUtf8("")))
})

it("writes a list level outside a slide with PowerPoint's text box indents", () => {
  const notes = "ppt/notesSlides/notesSlide1.xml"
  const body =
    '<p:notes><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="N"/></p:nvSpPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>One</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>'
  const value: TextValue = [{ from: 0, list: "bullets", level: 1, runs: [{ from: 0, text: "One" }] }]
  const after = applyRoute(new Map([[notes, encodeUtf8(body)]]), { name: "text", part: notes, shape: "2", value })
  expect(decodeUtf8(after.get(notes) ?? encodeUtf8(""))).toContain('<a:pPr marL="742950" lvl="1" indent="-285750">')
})

import { expect, it } from "vitest"
import { readNotes, writeNotes, routeRuns } from "./index.js"

import { encodeUtf8 as encode, decodeUtf8 } from "./package-bytes.js"
const body = `<p:notes><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2"/><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Speak</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>1</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`
const part = "ppt/notesSlides/notesSlide1.xml"
const parts = new Map([
  [
    "ppt/presentation.xml",
    encode(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="r1"/></p:sldIdLst></p:presentation>`),
  ],
  [
    "ppt/_rels/presentation.xml.rels",
    encode(`<Relationships><Relationship Id="r1" Type="x/slide" Target="slides/slide1.xml"/></Relationships>`),
  ],
  [
    "ppt/slides/_rels/slide1.xml.rels",
    encode(
      `<Relationships><Relationship Id="r2" Type="x/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`,
    ),
  ],
  [part, encode(body)],
])

it("reads the body placeholder and changes only its paragraphs", () => {
  expect(readNotes(parts)).toEqual([{ slide: "256", part, text: "Speak" }])
  const next = writeNotes(parts, "256", "First & <second>\n日本語")
  expect(readNotes(next)[0]?.text).toBe("First & <second>\n日本語")
  expect(decodeUtf8(next.get(part)!)).toContain(`<a:t>1</a:t>`)
  for (const [name, bytes] of parts) if (name !== part) expect(next.get(name)).toBe(bytes)
})

it.fails("creates notes and a notes master for a slide without a notes part", () => {
  const empty = new Map(parts)
  empty.delete(part)
  const next = writeNotes(empty, "256", "New notes")
  expect(readNotes(next)[0]?.text).toBe("New notes")
  expect([...next.keys()].some((name) => name.startsWith("ppt/notesMasters/"))).toBe(true)
})

it("judges edited notes as changing only the notes part", () => {
  const run = routeRuns(parts).find((run) => run.operation === "notes.body")
  expect(run?.error).toBeNull()
  expect(run?.touch).toEqual({ changed: [part], added: [], removed: [] })
  expect(readNotes(run!.parts!)[0]?.text).toBe("Edited speaker notes & a second line\nContinue here.")
})

it("keeps untouched notes byte for byte", () => {
  expect(writeNotes(parts, "256", "Speak").get(part)).toBe(parts.get(part))
})

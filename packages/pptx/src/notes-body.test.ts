import { expect, it } from "vitest"
import { slideId } from "@airdesign/document"
import { orderKeyBetween } from "@airdesign/doom"
import { orderedParts, readPackage, sharedOwnedParts, routeRuns, touchMatches } from "./index.js"
import { notesLinkFailures } from "./notes-links.js"
import { readNotes, writeNotes } from "./notes-body.js"

import { encodeUtf8 as encode, decodeUtf8 } from "./package-bytes.js"
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

function changedNames(before: ReadonlyMap<string, Uint8Array>, after: ReadonlyMap<string, Uint8Array>) {
  const names = [...after.keys()].sort()
  return {
    changed: names.filter((name) => before.has(name) && before.get(name) !== after.get(name)),
    added: names.filter((name) => !before.has(name)),
  }
}

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

it("creates notes and a notes master for a slide without a notes part", async () => {
  const blank = await fixture("blank.pptx")
  const next = writeNotes(blank, "256", "New notes")
  expect(readNotes(next)).toEqual([{ slide: "256", part, text: "New notes" }])
  expect(changedNames(blank, next)).toEqual({
    changed: [
      "[Content_Types].xml",
      "ppt/_rels/presentation.xml.rels",
      "ppt/presentation.xml",
      "ppt/slides/_rels/slide1.xml.rels",
    ],
    added: [
      "ppt/notesMasters/_rels/notesMaster1.xml.rels",
      "ppt/notesMasters/notesMaster1.xml",
      "ppt/notesSlides/_rels/notesSlide1.xml.rels",
      part,
      "ppt/theme/theme2.xml",
    ],
  })
  expect(decodeUtf8(next.get("ppt/presentation.xml")!)).toMatch(
    /<\/p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId\d+"\/><\/p:notesMasterIdLst><p:sldIdLst>/,
  )
  expect(next.get("ppt/theme/theme2.xml")).toBe(blank.get("ppt/theme/theme1.xml"))
  expect(notesLinkFailures(next)).toEqual([])
  expect(writeNotes(blank, "256", "")).toEqual(blank)
  const run = routeRuns(blank).find((run) => run.operation === "notes.new")
  expect(run?.error).toBeNull()
  expect(touchMatches(blank, run!.parts!, run!.touch!)).toBe(true)
})

it("gives a copy of a slide whose notes were just created its own notes slide", async () => {
  const withNotes = writeNotes(await fixture("blank.pptx"), "256", "New notes")
  const copied = orderedParts(
    withNotes,
    {
      file: [slideId("256")],
      order: [{ slide: "clone", id: slideId("257"), source: slideId("256"), key: orderKeyBetween(null, null) }],
    },
    () => undefined,
  )
  const notes = readNotes(copied)
  expect(notes.map((each) => each.text)).toEqual(["New notes", "New notes"])
  expect(new Set(notes.map((each) => each.part)).size).toBe(2)
  expect(sharedOwnedParts(copied)).toEqual([])
  expect(notesLinkFailures(copied)).toEqual([])
})

it("adds only the notes slide when the deck has a notes master", async () => {
  const deck = await fixture("nasa-1d-cnn.pptx")
  const next = writeNotes(deck, "452", "Second slide notes")
  expect(readNotes(next).find((notes) => notes.slide === "452")?.text).toBe("Second slide notes")
  expect(changedNames(deck, next)).toEqual({
    changed: ["[Content_Types].xml", "ppt/slides/_rels/slide2.xml.rels"],
    added: ["ppt/notesSlides/_rels/notesSlide2.xml.rels", "ppt/notesSlides/notesSlide2.xml"],
  })
  expect(decodeUtf8(next.get("ppt/notesSlides/_rels/notesSlide2.xml.rels")!)).toContain(
    `Target="../notesMasters/notesMaster1.xml"`,
  )
  expect(notesLinkFailures(next)).toEqual([])
})

it("adds a body to a notes part that has none", () => {
  const bare = new Map(parts)
  bare.set(
    part,
    encode(
      `<p:notes><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="4"/></p:nvSpPr></p:sp></p:spTree></p:cSld></p:notes>`,
    ),
  )
  expect(readNotes(bare)).toEqual([])
  const next = writeNotes(bare, "256", "Body now")
  expect(readNotes(next)).toEqual([{ slide: "256", part, text: "Body now" }])
  expect(decodeUtf8(next.get(part)!)).toContain(`<p:cNvPr id="5" name="Notes Placeholder 4"/>`)
})

it("names a notes slide whose links point nowhere", () => {
  const broken = new Map(parts)
  broken.set(
    "ppt/notesSlides/_rels/notesSlide1.xml.rels",
    encode(`<Relationships><Relationship Id="r1" Type="x/slide" Target="../slides/slide9.xml"/></Relationships>`),
  )
  expect(notesLinkFailures(broken)).toEqual([
    "ppt/notesSlides/notesSlide1.xml slide",
    "ppt/notesSlides/notesSlide1.xml master",
    "presentation notes master",
  ])
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

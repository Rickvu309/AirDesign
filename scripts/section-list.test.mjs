import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  sectionPlants,
  sectionProofDeck,
  sectionProofFile,
  sectionProofLines,
  sectionWarnLines,
  writeSectionProof,
} from "./section-list.mjs"

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const section = (name, id, slides) =>
  `<p14:section name="${name}" id="${id}"><p14:sldIdLst>${slides.map((slide) => `<p14:sldId id="${slide}"/>`).join("")}</p14:sldIdLst></p14:section>`
const sections =
  section("Part 2", "{45EA7723-C68D-4570-8DAA-C0AC0547D697}", ["2773"]) +
  section("Appendices", "{1FE94D9B-CEE8-4448-8F0B-9CD832F32C6F}", ["2774", "2775"])
const parts = new Map([
  [
    "ppt/presentation.xml",
    encoder.encode(`<p:presentation><p14:sectionLst>${sections}</p14:sectionLst></p:presentation>`),
  ],
  ["ppt/slides/slide1.xml", encoder.encode("<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>")],
])
const text = (written, name) => decoder.decode(written.get(name))
const plant = (name) => sectionPlants.find((row) => row.name === name).plant(parts)

assert.equal(sectionProofDeck, "doe-heat-pumps.pptx")
assert.equal(text(plant("uncovered"), "ppt/presentation.xml").includes('"2775"'), false)
assert.match(
  text(plant("twice"), "ppt/presentation.xml"),
  /id="2773"\/><\/p14:sldIdLst>.*id="2773"\/><p14:sldId id="2774"/,
)
assert.match(text(plant("order"), "ppt/presentation.xml"), /<p14:sectionLst><p14:section name="Appendices"/)
assert.match(text(plant("malformed"), "ppt/presentation.xml"), /id="\{1FE94D9B\}"/)
assert.equal(text(plant("duplicate"), "ppt/presentation.xml").split("{45EA7723-C68D-4570-8DAA-C0AC0547D697}").length, 3)
assert.match(text(plant("stray"), "ppt/presentation.xml"), /id="2775"\/><p14:sldId id="9999"\/>/)
assert.match(text(plant("zoom"), "ppt/slides/slide1.xml"), /sectionId="\{1FE94D9B-CEE8-4448-8F0B-9CD832F32C6F\}"/)
assert.match(text(plant("dangling"), "ppt/slides/slide1.xml"), /sectionId="\{0E5EC7A1-0000-4000-8000-000000000000\}"/)
assert.throws(() => sectionPlants[1].plant(new Map([["ppt/presentation.xml", encoder.encode("<p:presentation/>")]])))

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "section-list-"))
try {
  const proof = writeSectionProof({ parts, directory: folder })
  assert.deepEqual(
    proof.map((row) => path.basename(row.file)),
    sectionPlants.map((row) => sectionProofFile(row.name)),
  )
  assert.equal(fs.readFileSync(proof[0].file).subarray(0, 4).toString("hex"), "504b0304")
  const fake = {
    sectionListFailures: (written) => {
      const xml = text(written, "ppt/presentation.xml")
      if (xml.includes("9999")) return ["slide: section 2 lists slide 9999, which is not in the deck"]
      if (text(written, "ppt/slides/slide1.xml").includes("0E5EC7A1")) return ["reference: gone"]
      return []
    },
    newValidatorErrors: (before, after) => after.filter((line) => !before.includes(line)),
  }
  const lists = new Map([
    [sectionProofDeck, []],
    [sectionProofFile("zoom"), []],
    [sectionProofFile("stray"), ["Error: schema"]],
    [sectionProofFile("dangling"), []],
  ])
  const rows = proof.filter((row) => ["zoom", "stray", "dangling", "uncovered"].includes(row.name))
  assert.deepEqual(sectionProofLines({ pptx: fake, proof: rows, lists }), [
    "section list proof clean, a section zoom to a section the list has: our check passes it, the validator is blind",
    "section list proof cover, a slide in no section: our check misses it, the validator gave no answer",
    "section list proof slide, a section slide the deck lacks: our check finds it, the validator sees it",
    "section list proof reference, a section zoom to a section the list lacks: our check finds it, the validator is blind",
  ])
  assert.deepEqual(
    sectionWarnLines({
      pptx: fake,
      files: [
        ["a.pptx", parts],
        ["b.pptx", plant("stray")],
      ],
    }),
    [
      "section list warns b.pptx: 1, first slide: section 2 lists slide 9999, which is not in the deck",
      "section list checked 2 files, 1 warn, and it blocks nothing yet",
    ],
  )
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

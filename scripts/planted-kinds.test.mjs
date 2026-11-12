import { breakKinds } from "./planted-kinds.mjs"
import { seededRandom } from "./judge-proof.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("eleven break kinds are planted", Object.keys(breakKinds).length, 11)

const relType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const notes = (number) =>
  `<Relationships><Relationship Id="rId1" Type="${relType}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${relType}/notesSlide" Target="../notesSlides/notesSlide${number}.xml"/></Relationships>`
const encoder = new TextEncoder()
const deck = new Map([
  ["ppt/slides/_rels/slide1.xml.rels", encoder.encode(notes(1))],
  ["ppt/slides/_rels/slide2.xml.rels", encoder.encode(notes(2))],
])
const planted = breakKinds["owned part shared"]({}, deck, seededRandom(3))
const targets = [...planted.parts.values()].map(
  (bytes) => /notesSlide\d\.xml/.exec(new TextDecoder().decode(bytes))?.[0],
)
same("a planted shared part points two slides at one notes part", new Set(targets).size, 1)
same(
  "the planted shared part keeps every other relationship",
  [...planted.parts.values()].every((bytes) => new TextDecoder().decode(bytes).includes("slideLayout1.xml")),
  true,
)
let refused = ""
try {
  breakKinds["owned part shared"](
    {},
    new Map([["ppt/slides/_rels/slide1.xml.rels", encoder.encode(notes(1))]]),
    seededRandom(3),
  )
} catch (error) {
  refused = error.constructor.name
}
same("a deck with one owned part has no place to share it", refused, "NoPlace")

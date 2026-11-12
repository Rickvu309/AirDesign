import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  boxExportLines,
  boxExportName,
  boxOriginalName,
  boxRoutes,
  freshExports,
  judgedExportNames,
  paragraphExportLines,
  paragraphsExpected,
  paragraphsExportName,
  paragraphsOriginalName,
  validatorFiles,
} from "./paragraph-export.mjs"
import { slideExportLines, slideExportName, slideKeptParts, slideOriginalName } from "./slide-export.mjs"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paragraph-export-"))
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }))

const deck = path.join(dir, "exported-deck.pptx")
const paragraphs = path.join(dir, paragraphsExportName)
const box = path.join(dir, boxExportName)
fs.writeFileSync(deck, "old deck")
fs.writeFileSync(paragraphs, "old paragraphs")
fs.writeFileSync(box, "old box")
let seen = ""
const spec = await freshExports({
  deck,
  paragraphs,
  box,
  run: async () => {
    seen = `${fs.existsSync(deck)} ${fs.existsSync(paragraphs)} ${fs.existsSync(box)}`
    fs.writeFileSync(deck, "fresh deck")
    fs.writeFileSync(paragraphs, "fresh paragraphs")
  },
})
if (seen !== "false false false") throw new Error(`a stale export was there when the spec ran: ${seen}`)
if (spec.ok) throw new Error("a spec that wrote no exported-box.pptx passed")
if (!spec.line.includes(`wrote no tests/browser/${boxExportName}`)) throw new Error(spec.line)

if (judgedExportNames({ ok: true }).join() !== [paragraphsExportName, boxExportName, slideExportName].join()) {
  throw new Error("a good spec must judge the paragraph, box and slide exports")
}
if (judgedExportNames({ ok: false }).length !== 0) {
  throw new Error("a failed spec must judge no export")
}

const fixturePath = (name) => path.join("fixtures", name)
const files = validatorFiles({
  names: new Map([
    ["clean.pptx", 1],
    [paragraphsExportName, 2],
  ]).keys(),
  fixturePath,
  others: ["route.pptx"],
})
if (!files.includes(path.join("fixtures", paragraphsExportName))) {
  throw new Error("the validator list left out the paragraph export")
}
if (!files.includes("route.pptx") || !files.includes(path.join("fixtures", "clean.pptx"))) {
  throw new Error("the validator list lost a file")
}

const fakePptx = (failures) => ({
  paragraphExportFailures: () => failures,
  routeExportFailures: (before, after, routes) => (routes === boxRoutes ? failures : ["routes"]),
  slideExportFailures: (before, after, kept) => (kept === slideKeptParts ? failures : ["kept"]),
  danglingShapeReferences: () => [],
  newDanglingShapeReferences: (before, after) => after.filter((item) => !before.includes(item)),
  newValidatorErrors: (before, after) => after.filter((item) => !before.includes(item)),
  newDuplicateShapeIds: (before, after) => after.filter((item) => !before.includes(item)),
})
const judgedParts = new Map([
  [paragraphsOriginalName, new Map()],
  [paragraphsExportName, new Map()],
  [boxOriginalName, new Map()],
  [boxExportName, new Map()],
  [slideOriginalName, new Map()],
  [slideExportName, new Map()],
])
const answers = ({ before = [], after = [], idsBefore = [], idsAfter = [] } = {}) => ({
  parts: judgedParts,
  lists: new Map([
    [paragraphsOriginalName, before],
    [paragraphsExportName, after],
    [boxOriginalName, before],
    [boxExportName, after],
    [slideOriginalName, before],
    [slideExportName, after],
  ]),
  ids: new Map([
    [paragraphsOriginalName, idsBefore],
    [paragraphsExportName, idsAfter],
    [boxOriginalName, idsBefore],
    [boxExportName, idsAfter],
    [slideOriginalName, idsBefore],
    [slideExportName, idsAfter],
  ]),
  orders: new Map([
    [paragraphsOriginalName, []],
    [paragraphsExportName, []],
    [boxOriginalName, []],
    [boxExportName, []],
    [slideOriginalName, []],
    [slideExportName, []],
  ]),
})
const lines = (failures, input) => paragraphExportLines({ pptx: fakePptx(failures), ...answers(input) })

if (lines([]).length !== 0) throw new Error("a clean export produced a failure")
if (!lines(["part order"]).includes("paragraph export part order")) {
  throw new Error("the comparison failures were dropped")
}
if (!lines([], { before: ["old"], after: ["old", "new"] }).some((line) => line.includes("validator new"))) {
  throw new Error("a new validator error was ignored")
}
if (lines([], { before: ["old"], after: ["old"] }).length !== 0) throw new Error("an old validator error counted")
if (!lines([], { idsAfter: [{ id: "45" }] }).some((line) => line.includes("duplicate shape id"))) {
  throw new Error("a new duplicate shape id was ignored")
}
let missing = ""
try {
  paragraphExportLines({ pptx: fakePptx([]), ...answers(), parts: new Map() })
} catch (error) {
  missing = error instanceof Error ? error.message : String(error)
}
if (missing !== "paragraph export") throw new Error("a missing export was not refused")
if (paragraphsExpected.value.length !== 5) throw new Error("the expected value changed")

const boxLines = (failures, input) => boxExportLines({ pptx: fakePptx(failures), ...answers(input) })
if (boxLines([]).length !== 0) throw new Error("a clean box export produced a failure")
if (!boxLines(["ppt/slides/slide1.xml bytes"]).includes("box export ppt/slides/slide1.xml bytes")) {
  throw new Error("the box route failures were dropped")
}
if (!boxLines([], { before: ["old"], after: ["old", "new"] }).some((line) => line.startsWith("box export validator"))) {
  throw new Error("a new validator error on the box export was ignored")
}
if (boxRoutes.some((route) => route.part !== "ppt/slides/slide1.xml" || route.shape !== "2")) {
  throw new Error("the box routes left the shape the box export spec moves")
}

const slideLines = (failures, input) => slideExportLines({ pptx: fakePptx(failures), ...answers(input) })
if (slideLines([]).length !== 0) throw new Error("a clean slide export produced a failure")
if (!slideLines(["ppt/slides/slide1.xml"]).includes("slide export ppt/slides/slide1.xml")) {
  throw new Error("the untouched slide failures were dropped")
}
if (
  !slideLines([], { before: ["old"], after: ["old", "new"] }).some((line) => line.startsWith("slide export validator"))
) {
  throw new Error("a new validator error on the slide export was ignored")
}
const dangling = slideExportLines({
  pptx: {
    ...fakePptx([]),
    danglingShapeReferences: (parts) =>
      parts === judgedParts.get(slideExportName) ? [{ kind: "p:spTgt", id: "9" }] : [],
  },
  ...answers(),
})
if (!dangling.includes("slide export dangling p:spTgt 9")) throw new Error("a new dangling reference was ignored")
const slides = path.join(dir, slideExportName)
fs.writeFileSync(slides, "old slides")
const slideSpec = await freshExports({
  deck,
  paragraphs,
  box,
  slides,
  run: async () => {
    if (fs.existsSync(slides)) throw new Error("stale")
    fs.writeFileSync(deck, "fresh deck")
    fs.writeFileSync(paragraphs, "fresh paragraphs")
    fs.writeFileSync(box, "fresh box")
    fs.writeFileSync(slides, "fresh slides")
  },
})
if (!slideSpec.ok) throw new Error(slideSpec.line)

console.log("paragraph export tests passed")

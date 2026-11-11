import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  freshExports,
  judgedExportNames,
  paragraphExportLines,
  paragraphsExpected,
  paragraphsExportName,
  paragraphsOriginalName,
  validatorFiles,
} from "./paragraph-export.mjs"

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paragraph-export-"))
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }))

const deck = path.join(dir, "exported-deck.pptx")
const paragraphs = path.join(dir, paragraphsExportName)
fs.writeFileSync(deck, "old deck")
fs.writeFileSync(paragraphs, "old paragraphs")
let seen = ""
const spec = await freshExports({
  deck,
  paragraphs,
  run: async () => {
    seen = `${fs.existsSync(deck)} ${fs.existsSync(paragraphs)}`
    fs.writeFileSync(deck, "fresh deck")
  },
})
if (seen !== "false false") throw new Error(`a stale export was there when the spec ran: ${seen}`)
if (spec.ok) throw new Error("a spec that wrote no exported-paragraphs.pptx passed")
if (!spec.line.includes(`wrote no tests/browser/${paragraphsExportName}`)) throw new Error(spec.line)

if (judgedExportNames({ ok: true }).join() !== paragraphsExportName) {
  throw new Error("a good spec must judge both exports")
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
  newValidatorErrors: (before, after) => after.filter((item) => !before.includes(item)),
  newDuplicateShapeIds: (before, after) => after.filter((item) => !before.includes(item)),
})
const judgedParts = new Map([
  [paragraphsOriginalName, new Map()],
  [paragraphsExportName, new Map()],
])
const answers = ({ before = [], after = [], idsBefore = [], idsAfter = [] } = {}) => ({
  parts: judgedParts,
  lists: new Map([
    [paragraphsOriginalName, before],
    [paragraphsExportName, after],
  ]),
  ids: new Map([
    [paragraphsOriginalName, idsBefore],
    [paragraphsExportName, idsAfter],
  ]),
  orders: new Map([
    [paragraphsOriginalName, []],
    [paragraphsExportName, []],
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

console.log("paragraph export tests passed")

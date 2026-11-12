import path from "node:path"
import {
  boxExportLines,
  boxExportName,
  boxOriginalName,
  boxRoutes,
  paragraphExportLines,
  paragraphsExpected,
  paragraphsExportName,
  paragraphsOriginalName,
  validatorFiles,
} from "./paragraph-export.mjs"
import { slideExportLines, slideExportName, slideKeptParts, slideOriginalName } from "./slide-export.mjs"

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
  partCopies: () => new Map(),
  sharedOwnedParts: () => [],
  newSharedOwnedParts: () => [],
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
console.log("paragraph export tests passed")

import fs from "node:fs"
import { judge, judgeParts } from "./judge.mjs"
import { scoreWrittenRoute } from "./pptx-route-judge.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const countingPptx = {
  newValidatorErrors: (before, after) => after.filter((line) => !before.includes(line)),
  newDuplicateShapeIds: () => [],
}
const dangling = "ppt/slides/slide1.xml p:spTgt 9"
same(
  "the judge rejects a dangling shape reference passed to it",
  judge(countingPptx, { list: [], ids: [], orders: [] }, { list: [], ids: [], orders: [], dangling: [dangling] })
    .accepted,
  false,
)
same(
  "an old caller that passes no dangling data is still accepted",
  judge(countingPptx, { list: [], ids: [], orders: [] }, { list: [], ids: [], orders: [] }).accepted,
  true,
)
const partsPptx = {
  ...countingPptx,
  shapeIdCounts: () => [],
  branchOrderErrors: () => [],
  danglingShapeReferences: (parts) => parts,
  newDanglingShapeReferences: (before, after) => after.filter((row) => !before.includes(row)),
  sharedOwnedParts: () => [],
  partCopies: () => new Map(),
  newSharedOwnedParts: (before, after) => after.filter((row) => !before.includes(row)),
  newNotesLinkFailures: () => [],
}
const judgedDeck = (references, shared = []) => ({ list: [], ids: [], orders: [], references, shared })
same(
  "the path pptx-check uses rejects a planted dangling shape reference",
  judgeParts(partsPptx, judgedDeck([]), [], [dangling]).accepted,
  false,
)
same(
  "the path pptx-check uses does not blame a dangling shape reference the deck already had",
  judgeParts(partsPptx, judgedDeck([dangling]), [], [dangling]).accepted,
  true,
)
const checkSource = fs.readFileSync(new URL("./pptx-check.mjs", import.meta.url), "utf8")
same(
  "pptx-check judges only through judgeParts, which always supplies the dangling data",
  [
    checkSource.includes('import { judgeParts, validatorBlindFaults } from "./judge.mjs"'),
    /\bjudge\(/.test(checkSource),
  ],
  [true, false],
)
same(
  "pptx-check compares each deck's own dangling references before and after",
  [
    checkSource.includes("references: references.get(name)"),
    checkSource.includes("pptx.danglingShapeReferences(packageParts)"),
  ],
  [true, true],
)
same(
  "pptx-check fails a case that leaves a dangling reference, judged against the case's own after parts",
  [checkSource.includes("dangling.length !== 0"), checkSource.includes("parts.get(row.after)")],
  [true, true],
)
same(
  "pptx-check scores only the files writtenRouteFiles made, which always carry the dangling data",
  checkSource.includes("await writtenRouteFiles("),
  true,
)
const orderFault = "Order: p:spPr after p:txBody in p:sp of a markup branch /ppt/slides/slide1.xml"
same(
  "the judge rejects a new order error",
  judge(countingPptx, { list: [], ids: [], orders: [] }, { list: [], ids: [], orders: [orderFault] }).accepted,
  false,
)
same(
  "the judge does not blame an order error the deck already had",
  judge(countingPptx, { list: [], ids: [], orders: [orderFault] }, { list: [], ids: [], orders: [orderFault] })
    .accepted,
  true,
)
const sharedChart = { part: "ppt/charts/chart1.xml", owners: ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"] }
same(
  "the judge names a part of a kind each slide owns that two parts point at",
  judge(countingPptx, { list: [], ids: [], orders: [] }, { list: [], ids: [], orders: [], shared: [sharedChart] }),
  {
    errors: ["Shared part: ppt/charts/chart1.xml belongs to ppt/slides/slide1.xml and ppt/slides/slide2.xml"],
    dupes: [],
    dangling: [],
    accepted: false,
  },
)
const sharingPptx = { ...partsPptx, danglingShapeReferences: () => [], sharedOwnedParts: (parts) => parts }
same(
  "the path pptx-check uses rejects a shared chart the deck did not have",
  judgeParts(sharingPptx, judgedDeck([]), [], [sharedChart]).accepted,
  false,
)
same(
  "the path pptx-check uses does not blame a shared chart the deck already had",
  judgeParts(sharingPptx, judgedDeck([], [sharedChart]), [], [sharedChart]).accepted,
  true,
)
same(
  "pptx-check compares each deck's own shared parts before and after",
  [checkSource.includes("shared: shared.get(name)"), checkSource.includes("pptx.sharedOwnedParts(packageParts)")],
  [true, true],
)
const sharingRoute = { ...sharingPptx, touchMatches: () => true }
same(
  "a written route that shares a chart between two slides fails",
  scoreWrittenRoute(
    sharingRoute,
    [],
    [],
    { run: { operation: "sldIdLst.clone", error: null, touch: {} }, exportError: null, back: [sharedChart] },
    [],
  )?.shared,
  1,
)
const copyingPptx = {
  ...countingPptx,
  newValidatorErrors: (before, after, copies) =>
    copies?.get("ppt/charts/chart5.xml") === "ppt/charts/chart2.xml" ? [] : after,
}
same(
  "the judge hands the validator comparison the parts an export copied",
  judge(
    copyingPptx,
    { list: [], ids: [], orders: [] },
    { list: ["copied"], ids: [], orders: [], copies: new Map([["ppt/charts/chart5.xml", "ppt/charts/chart2.xml"]]) },
  ).accepted,
  true,
)

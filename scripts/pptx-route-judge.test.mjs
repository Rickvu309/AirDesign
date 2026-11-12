import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { scoreWrittenRoute, writtenRouteFiles } from "./pptx-route-judge.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const broken = "notes slide linked to nothing"
const dangling = "ppt/slides/slide1.xml p:spTgt 9"
const pptx = {
  newValidatorErrors: () => [],
  newDuplicateShapeIds: () => [],
  shapeIdCounts: () => [],
  danglingShapeReferences: (parts) => parts.filter((row) => row === dangling),
  newDanglingShapeReferences: (before, after) => after.filter((row) => !before.includes(row)),
  touchMatches: () => true,
  newNotesLinkFailures: (before, after) => (after.includes(broken) && !before.includes(broken) ? [broken] : []),
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "route-judge-"))
const written = async (before, back) => {
  const filing = {
    ...pptx,
    routeRuns: () => [{ operation: "notes.new", error: null, touch: {}, parts: [] }],
    exportPackage: async () => new Uint8Array(),
    readParts: async () => back,
  }
  const [item] = await writtenRouteFiles(filing, new Uint8Array(), before, folder, "deck")
  return item
}
try {
  same(
    "a written route that leaves a new dangling reference fails",
    scoreWrittenRoute(pptx, [], [], await written([], [dangling]), [])?.dangling,
    1,
  )
  same(
    "a written route is not blamed for a dangling reference the deck already had",
    scoreWrittenRoute(pptx, [dangling], [], await written([dangling], [dangling]), []),
    null,
  )
  same(
    "a written route that leaves a notes slide linked to nothing fails",
    scoreWrittenRoute(pptx, [], [], await written([], [broken]), [])?.notes,
    [broken],
  )
  same(
    "a written route is not blamed for a notes link the deck already broke",
    scoreWrittenRoute(pptx, [broken], [], await written([broken], [broken]), []),
    null,
  )
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}
console.log("pptx-route-judge tests passed")

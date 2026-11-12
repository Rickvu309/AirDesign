import assert from "node:assert/strict"
import { blankExportLines, blankExportName, blankOriginalName } from "./blank-export.mjs"

const parts = new Map([
  [blankOriginalName, new Map()],
  [blankExportName, new Map()],
])
const lines = (before, after, failures = []) =>
  blankExportLines({
    pptx: { routeExportFailures: () => failures },
    parts,
    lists: new Map([
      [blankOriginalName, before],
      [blankExportName, after],
    ]),
  })
assert.deepEqual(lines([], []), [])
assert.ok(lines(["original error"], []).some((line) => line.includes("original error")))
assert.ok(lines([], ["export error"]).some((line) => line.includes("export error")))
assert.ok(lines(undefined, []).some((line) => line.includes("no validator result")))
assert.ok(lines([], [], ["untouched part"]).some((line) => line.includes("untouched part")))
console.log("blank export judge tests passed")

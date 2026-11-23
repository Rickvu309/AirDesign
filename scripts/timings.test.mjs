import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { measuredName } from "./spec-seconds.mjs"
import { foldTimings, timingRefusals, timingsCommand } from "./timings.mjs"

const pdfExport = [
  "apps/web/src/export/print-page.ts",
  "scripts/pdf-check.mjs",
  "tests/browser/export-pdf.spec.ts",
  "tests/browser/spec-seconds.json",
]
const [refusal, ...more] = timingRefusals(pdfExport)
assert.deepEqual(more, [], "PR 1463 at 0b38eaf changed one timing record")
assert.match(refusal, /^tests\/browser\/spec-seconds\.json changed beside other files\./, "the refusal names the file")
assert.ok(refusal.includes(`\`${timingsCommand}\``), "the refusal names the command that owns the file")
assert.ok(refusal.includes("git checkout origin/main -- tests/browser/spec-seconds.json"))
assert.equal(
  timingRefusals(["scripts/pdf-check.mjs", "tests/unit-seconds.json", "tests/journeys/journey-seconds.json"]).length,
  2,
  "each record changed beside other files is named",
)
assert.deepEqual(timingRefusals(pdfExport.slice(0, 3)), [], "a pull request that leaves the records alone passes")
assert.deepEqual(
  timingRefusals(["tests/browser/spec-seconds.json", "tests/unit-seconds.json", "tests/journeys/journey-seconds.json"]),
  [],
  "the pull request of pnpm timings changes only records, and passes",
)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "timings-"))
try {
  const write = (name, value) => {
    fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true })
    fs.writeFileSync(path.join(folder, name), typeof value === "string" ? value : JSON.stringify(value))
  }
  write("tests/browser/kept.spec.ts", "")
  write("tests/browser/new.spec.ts", "")
  write("tests/browser/spec-seconds.json", {
    seconds: { "kept.spec.ts": 10, "gone.spec.ts": 3 },
    export: { "kept.spec.ts": 4, "gone.spec.ts": 1 },
  })
  write(measuredName("tests/browser/spec-seconds.json"), {
    seconds: { "kept.spec.ts": 12, "new.spec.ts": 5 },
    export: { "kept.spec.ts": null, "new.spec.ts": 2 },
  })
  write(".agents/skills/verify-airdesign/journeys/sign-in.mjs", "")
  write(".agents/skills/verify-airdesign/journeys/new-deck.mjs", "")
  const journeys = JSON.stringify({ "removed-journey": 4, "sign-in": 2 })
  write("tests/journeys/journey-seconds.json", journeys)
  write(measuredName("tests/journeys/journey-seconds.json"), { seconds: { "new-deck": 6, "sign-in": 2.5 }, export: {} })
  write("tests/unit-seconds.json", JSON.stringify({ "a.test.ts": 1 }))

  assert.deepEqual(foldTimings(folder), [
    { record: "tests/browser/spec-seconds.json", changed: true },
    { record: "tests/journeys/journey-seconds.json", changed: true },
  ])
  const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"))
  assert.deepEqual(
    read("tests/browser/spec-seconds.json"),
    { seconds: { "kept.spec.ts": 10, "new.spec.ts": 5 }, export: { "new.spec.ts": 2 } },
    "a spec within double keeps its record, a new one is added, a gone one leaves, and one with no export test drops its export seconds",
  )
  assert.deepEqual(
    read("tests/journeys/journey-seconds.json"),
    { "new-deck": 6, "sign-in": 2 },
    "a journey with no file leaves the record",
  )
  assert.equal(read("tests/unit-seconds.json")["a.test.ts"], 1, "a record with nothing measured stays")
  assert.ok(
    !fs.existsSync(path.join(folder, measuredName("tests/browser/spec-seconds.json"))),
    "folded measures are spent",
  )
  assert.deepEqual(foldTimings(folder), [], "a second fold finds nothing measured")
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

console.log(
  "timings: local runs measure beside the records, pnpm timings folds them in, and a record changed beside other files is refused",
)

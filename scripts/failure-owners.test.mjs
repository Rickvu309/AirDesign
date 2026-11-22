import { failedTests } from "./failed-tests.mjs"
import { outsideTheDiff } from "./fresh-run.mjs"
import { journeysSpec } from "./failure-owners.mjs"
import { fixture, same } from "./land-harness.mjs"
import { raceTitle } from "./race-issue.mjs"

const browserJob = { name: "check (browser 2/4)", log: fixture("job-playwright-failed.log") }
const appFile = "apps/web/src/editor/save.ts"

const sources = {
  "tests/browser/save-status.spec.ts":
    'import { deckTest } from "./deck-test"\nimport { deckState } from "./deck-state.js"',
  "tests/browser/deck-test.ts": 'import { fixtures } from "./fixtures"',
  "tests/browser/deck-state.ts": "export const deckState = 1",
  "tests/browser/fixtures.ts": "export const fixtures = 1",
  "tests/journeys/journeys.spec.ts": 'import { deckStateFixture } from "../browser/deck-state"',
  ".agents/skills/verify-airdesign/journeys/adjust-tone.mjs": 'import { copy } from "../bin/product-copy.mjs"',
  ".agents/skills/verify-airdesign/bin/product-copy.mjs": "export const copy = 1",
}
const read = (file) => sources[file]
const owner = (jobs, files) => outsideTheDiff({ jobs, files, read })
same(
  "a diff that changes a helper the failed spec imports through another helper owns the failure",
  owner([browserJob], ["tests/browser/fixtures.ts"]).owned,
  true,
)
same(
  "a diff that changes a helper the failed spec imports directly owns the failure",
  owner([browserJob], ["tests/browser/deck-state.ts"]).owned,
  true,
)
same(
  "a diff that changes another browser spec leaves the failure outside",
  owner([browserJob], ["tests/browser/zoom-selection-resize.spec.ts"]).outside,
  true,
)
const adjustToneLog = [
  "2026-11-22T02:48:35.7501210Z   1) tests/journeys/journeys.spec.ts:152:7 › recorded Aira › adjust-tone ",
  "2026-11-22T02:48:35.7502908Z     Error: expect(locator).toBeVisible() failed",
  "2026-11-22T02:48:35.9367006Z failed: browser-tests",
].join("\n")
const adjustToneJob = { name: "journeys / journeys", log: adjustToneLog }
const adjustTone = (files) => owner([adjustToneJob], files)
same(
  "PR 1310 changes a new spec, spec-seconds.json and another journey, so adjust-tone stays outside the diff",
  [
    adjustTone([
      ".agents/skills/verify-airdesign/journeys/navigate-zoom-pan.mjs",
      "tests/browser/spec-seconds.json",
      "tests/browser/zoom-selection-resize.spec.ts",
    ]).outside,
    failedTests(adjustToneLog).map(raceTitle),
  ],
  [true, ["Race: tests/journeys/journeys.spec.ts › recorded Aira › adjust-tone"]],
)
same(
  "editing adjust-tone.mjs owns the adjust-tone failure",
  adjustTone([".agents/skills/verify-airdesign/journeys/adjust-tone.mjs"]).owned,
  true,
)
same(
  "editing a helper adjust-tone imports owns it",
  adjustTone([".agents/skills/verify-airdesign/bin/product-copy.mjs"]).owned,
  true,
)
same("editing the journeys spec owns it", adjustTone([journeysSpec]).owned, true)
same("editing a helper the journeys spec imports owns it", adjustTone(["tests/browser/deck-state.ts"]).owned, true)
same(
  "adding a row to spec-seconds.json or journey-seconds.json owns nothing",
  [
    adjustTone(["tests/browser/spec-seconds.json"]).outside,
    owner([browserJob], ["tests/browser/spec-seconds.json"]).outside,
    adjustTone(["tests/journeys/journey-seconds.json"]).outside,
  ],
  [true, true, true],
)
same(
  "an app change still gets its fresh run with the map off and none with it on",
  [
    adjustTone([appFile]).outside,
    outsideTheDiff({
      jobs: [adjustToneJob],
      files: [appFile],
      byMap: true,
      read,
    }).outside,
  ],
  [true, false],
)

console.log("failure-owners tests passed")

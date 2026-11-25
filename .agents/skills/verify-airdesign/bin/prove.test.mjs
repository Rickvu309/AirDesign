import { describe, expect, it } from "vitest"
import { proofPlan } from "./prove-plan.mjs"
import { lookResult } from "./prove.mjs"

const rules = [
  { name: "check", script: ["check"], paths: [""] },
  { name: "browser-tests", script: ["test:browser"], paths: ["apps/web/", "tests/browser/"] },
]

const facts = {
  base: "2c036f24",
  head: "1a2b3c4d",
  rules,
  moved: [],
  screens: {
    "/screens/s41-01-editor-grid-default": "editor",
    "/screens/s42-02-editor-agent-run-complete": "editor",
    "/screens/s31-04-decks-browse-all-decks-grid": "decks",
  },
  states: [
    { name: "agent-empty", design: "/screens/s42-02-editor-agent-run-complete" },
    { name: "agent-done", design: "/screens/s42-02-editor-agent-run-complete" },
    { name: "decks-all", design: "/screens/s31-04-decks-browse-all-decks-grid" },
    { name: "grid-add-added", design: "/screens/s41-01-editor-grid-default" },
    { name: "deck-gone", design: null },
  ],
  replays: [
    { name: "person-undo", by: ["tests/spec-replay.test.ts"] },
    { name: "usage", by: ["packages/usage/src/ledger.test.ts"] },
  ],
  scripts: {
    "scripts/metrics.mjs": [],
    "scripts/metrics.test.mjs": ["scripts/metrics.mjs"],
    "scripts/check.mjs": ["scripts/metrics.mjs"],
    "scripts/check.test.mjs": ["scripts/check.mjs"],
    "scripts/land.test.mjs": [],
  },
  reads: {
    "scripts/rule-table.test.mjs": ["AGENTS.md", "COMMANDS.md"],
    "scripts/affected-report.test.mjs": [".github/workflows/ci.yml"],
    "scripts/ci-queued.test.mjs": [".github/workflows/ci.yml", ".github/actions/queued/action.yml"],
    "scripts/check-specs.test.mjs": ["specs/edit/"],
    ".agents/skills/verify-airdesign/features/features.test.mjs": [".agents/skills/verify-airdesign/journeys/"],
  },
  browser: {
    "tests/browser/design-panel.ts": [],
    "tests/browser/person-undo.spec.ts": [],
    "tests/browser/color.spec.ts": ["tests/browser/design-panel.ts"],
    "tests/browser/home.spec.ts": [],
  },
}

const plan = (changed, more = {}) => proofPlan({ ...facts, changed, ...more })
const step = (changed, kind, more) => plan(changed, more).steps.find((each) => each.kind === kind)

describe("proofPlan", () => {
  it("a changed browser spec is planned five times on one worker under a CPU limit", () => {
    expect(step(["tests/browser/person-undo.spec.ts"], "browser-tests")).toMatchObject({
      specs: ["tests/browser/person-undo.spec.ts"],
      repeat: 5,
      workers: 1,
      cpu: "200%",
    })
    expect(step(["tests/browser/design-panel.ts"], "browser-tests").specs).toEqual(["tests/browser/color.spec.ts"])
  })

  it("a change to undo selects its unit test and its model when covered", () => {
    expect(step(["packages/doom/src/undo.ts"], "unit-tests")).toMatchObject({
      tests: "related",
      files: ["packages/doom/src/undo.ts"],
    })
  })

  it("a moved covered name plans that spec's TLC and its replay file", () => {
    expect(step(["packages/doom/src/undo.ts"], "model-check", { moved: ["person-undo"] })).toMatchObject({
      topics: ["person-undo"],
      replays: ["tests/spec-replay.test.ts"],
    })
    expect(step(["specs/usage/Usage.tla"], "model-check").replays).toEqual(["packages/usage/src/ledger.test.ts"])
    expect(step(["packages/doom/src/undo.ts"], "model-check")).toBeUndefined()
  })

  it("app code with no changed spec plans a note asking for the failing spec", () => {
    expect(step(["apps/web/src/decks/home.tsx"], "note").text).toContain("Write the failing spec first")
    expect(step(["apps/web/src/decks/home.tsx", "tests/browser/home.spec.ts"], "note")).toBeUndefined()
    expect(step(["apps/web/src/decks/home.test.tsx"], "note")).toBeUndefined()
  })

  it("plans the sibling test and every test that imports a changed script", () => {
    expect(step(["scripts/metrics.mjs"], "script-tests").files).toEqual([
      "scripts/check.test.mjs",
      "scripts/metrics.test.mjs",
    ])
    expect(step(["scripts/land.test.mjs"], "script-tests").files).toEqual(["scripts/land.test.mjs"])
  })

  it("plans each script test that reads a changed file, though no script changed", () => {
    expect(step(["AGENTS.md"], "script-tests").files).toEqual(["scripts/rule-table.test.mjs"])
    expect(step([".github/workflows/ci.yml"], "script-tests").files).toEqual([
      "scripts/affected-report.test.mjs",
      "scripts/ci-queued.test.mjs",
    ])
    expect(step(["specs/edit/Edit.tla"], "script-tests").files).toEqual(["scripts/check-specs.test.mjs"])
    expect(step(["specs/run/Run.tla"], "script-tests")).toBeUndefined()
    expect(step(["README.md"], "script-tests")).toBeUndefined()
  })

  it("leaves a unit test that reads a changed file to the unit tests", () => {
    expect(step([".agents/skills/verify-airdesign/journeys/theme.mjs"], "script-tests")).toBeUndefined()
  })

  it("joins the tests that import a changed script with the tests that read a changed file", () => {
    expect(step(["scripts/metrics.mjs", "AGENTS.md"], "script-tests").files).toEqual([
      "scripts/check.test.mjs",
      "scripts/metrics.test.mjs",
      "scripts/rule-table.test.mjs",
    ])
  })

  it("looks at the states whose design screen sits in a touched area", () => {
    expect(step(["apps/web/src/decks/home.tsx"], "look").states).toEqual(["decks-all"])
    expect(step(["packages/render/src/slide-canvas.tsx"], "look").states).toEqual([
      "agent-done",
      "agent-empty",
      "grid-add-added",
    ])
    expect(step([".agents/skills/verify-airdesign/look/states/deck-gone.mjs"], "look").states).toEqual(["deck-gone"])
    expect(step(["apps/web/src/decks/home.test.tsx"], "look")).toBeUndefined()
  })

  it("keeps every editor state for a Grid change, since the editor page imports Grid and shows it only at runtime", () => {
    expect(step(["apps/web/src/editor/editor-grid.tsx"], "look").states).toEqual([
      "agent-done",
      "agent-empty",
      "grid-add-added",
    ])
  })

  it.fails("looks at every state for a theme token change, since imports cannot see CSS", () => {
    expect(step(["packages/theme/src/tokens.css"], "look")?.states).toEqual([
      "agent-done",
      "agent-empty",
      "deck-gone",
      "decks-all",
      "grid-add-added",
    ])
  })

  it.fails("looks at the deck list too for a shared components/ui change", () => {
    expect(step(["apps/web/src/components/ui/button.tsx"], "look")?.states).toContain("decks-all")
  })

  it.fails("looks at the states that show a changed copy file's words", () => {
    expect(step(["apps/web/src/copy/aira-copy.ts"], "look")?.states).toContain("agent-done")
  })

  it("suggests the speed bench when the editor or the painter changes", () => {
    expect(step(["packages/render/src/slide-canvas.tsx"], "bench").because).toBe(
      "packages/render/src/slide-canvas.tsx changed",
    )
    expect(step(["apps/web/src/editor/editor-grid.tsx"], "bench")).toBeDefined()
    expect(step(["apps/web/src/editor/editor-grid.test.tsx"], "bench")).toBeUndefined()
    expect(step(["apps/web/src/decks/home.tsx"], "bench")).toBeUndefined()
  })

  it("names the suites ci also runs and runs nothing for a change outside code", () => {
    const words = plan(["GLOSSARY.md"])
    expect(words.steps).toEqual([])
    expect(words.ciAlso).toEqual(["check"])
    expect(plan(["tests/browser/home.spec.ts"]).ciAlso).toEqual(["check", "browser-tests"])
  })
})

describe("lookResult", () => {
  it("says FAILED when the sheet stops before it is written", () => {
    const stopped = { status: 1, output: "verify-airdesign sheet: ENOSPC: no space left on device\n" }
    expect(lookResult(stopped, "/run/sheet", "/run/look.log.sheet")).toEqual({
      passed: false,
      result: "FAILED before the sheet was written, see /run/look.log.sheet",
    })
  })

  it("names the states that failed and the findings of a written sheet", () => {
    const answer = (failed) => ({
      status: 0,
      output: `${JSON.stringify({ count: 12, states: 180, failed, summary: "/run/sheet/sheet-00.png" })}\n`,
    })
    expect(lookResult(answer(2), "/run/sheet", "/run/look.log.sheet")).toEqual({
      passed: false,
      result: "FAILED 2 of 180 states, findings 12, sheet /run/sheet/sheet-00.png",
    })
    expect(lookResult(answer(0), "/run/sheet", "/run/look.log.sheet")).toEqual({
      passed: true,
      result: "PASSED 180 states, findings 12, sheet /run/sheet/sheet-00.png",
    })
  })
})

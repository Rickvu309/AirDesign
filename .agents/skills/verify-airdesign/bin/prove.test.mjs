import { describe, expect, it } from "vitest"
import { proofPlan } from "./prove-plan.mjs"

const rules = [
  { name: "check", script: ["check"], paths: [""] },
  { name: "browser", script: ["test:browser"], paths: ["apps/web/", "tests/browser/"] },
  { name: "pptx", script: ["check:pptx"], paths: ["packages/pptx", "scripts/pptx-fixtures"] },
]

const facts = {
  base: "2c036f24",
  head: "1a2b3c4d",
  rules,
  moved: [],
  screens: {
    "/screens/s42-02-editor-agent-run-complete": "editor",
    "/screens/s31-04-decks-browse-all-decks-grid": "decks",
  },
  states: [
    { name: "agent-empty", design: "/screens/s42-02-editor-agent-run-complete" },
    { name: "agent-done", design: "/screens/s42-02-editor-agent-run-complete" },
    { name: "decks-all", design: "/screens/s31-04-decks-browse-all-decks-grid" },
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
    expect(step(["tests/browser/person-undo.spec.ts"], "browser")).toMatchObject({
      specs: ["tests/browser/person-undo.spec.ts"],
      repeat: 5,
      workers: 1,
      cpu: "200%",
    })
    expect(step(["tests/browser/design-panel.ts"], "browser").specs).toEqual(["tests/browser/color.spec.ts"])
  })

  it("a changed fixture under scripts/pptx-fixtures falls back to every unit test", () => {
    const fixture = plan(["scripts/pptx-fixtures/clean.pptx"])
    expect(fixture.steps.find((each) => each.kind === "unit")).toMatchObject({ tests: "all" })
    expect(fixture.steps.find((each) => each.kind === "pptx")).toBeDefined()
    expect(step(["packages/document/src/undo.ts"], "unit")).toMatchObject({
      tests: "related",
      files: ["packages/document/src/undo.ts"],
    })
  })

  it("a moved covered name plans that spec's TLC and its replay file", () => {
    expect(step(["packages/document/src/undo.ts"], "specs", { moved: ["person-undo"] })).toMatchObject({
      topics: ["person-undo"],
      replays: ["tests/spec-replay.test.ts"],
    })
    expect(step(["specs/usage/Usage.tla"], "specs").replays).toEqual(["packages/usage/src/ledger.test.ts"])
    expect(step(["packages/document/src/undo.ts"], "specs")).toBeUndefined()
  })

  it("app code with no changed spec plans a note asking for the failing spec", () => {
    expect(step(["apps/web/src/decks/home.tsx"], "note").text).toContain("Write the failing spec first")
    expect(step(["apps/web/src/decks/home.tsx", "tests/browser/home.spec.ts"], "note")).toBeUndefined()
    expect(step(["apps/web/src/decks/home.test.tsx"], "note")).toBeUndefined()
  })

  it("plans the sibling test and every test that imports a changed script", () => {
    expect(step(["scripts/metrics.mjs"], "tooling").files).toEqual([
      "scripts/check.test.mjs",
      "scripts/metrics.test.mjs",
    ])
    expect(step(["scripts/land.test.mjs"], "tooling").files).toEqual(["scripts/land.test.mjs"])
  })

  it("looks at the states whose design screen sits in a touched area", () => {
    expect(step(["apps/web/src/decks/home.tsx"], "look").states).toEqual(["decks-all"])
    expect(step(["packages/render/src/slide-canvas.tsx"], "look").states).toEqual(["agent-done", "agent-empty"])
    expect(step([".agents/skills/verify-airdesign/look/states/deck-gone.mjs"], "look").states).toEqual(["deck-gone"])
    expect(step(["apps/web/src/decks/home.test.tsx"], "look")).toBeUndefined()
  })

  it("names the suites ci also runs and runs nothing for a change outside code", () => {
    const words = plan(["GLOSSARY.md"])
    expect(words.steps).toEqual([])
    expect(words.ciAlso).toEqual(["check"])
    expect(plan(["tests/browser/home.spec.ts"]).ciAlso).toEqual(["check", "browser"])
  })
})

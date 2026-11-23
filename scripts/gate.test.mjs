import { stepsOf } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"
import { ciAlsoRuns, packagesFor, recordedSeconds, runGate, testsFor, unitSecondsBudget } from "./gate.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const inventory = [
  ...Array.from({ length: 300 }, (_, at) => `packages/document/src/t${String(at).padStart(3, "0")}.test.ts`),
  "packages/oauth/src/grant.test.ts",
  "tests/edit-replay.test.ts",
]
const mapOf = (unitTests, parts = {}) => ({
  everything: unitTests === "all",
  because: "pnpm-lock.yaml changes how every part runs",
  unitTests,
  parts,
})
const document = inventory.slice(0, 300)
same(
  "the gate runs only unit test files in the folders the map reaches, the same folders ci runs",
  testsFor({
    map: mapOf(["packages/oauth/"]),
    related: [...document, "packages/oauth/src/grant.test.ts"],
    inventory,
    changed: [],
  }),
  { files: ["packages/oauth/src/grant.test.ts"], reach: 1 },
)
same(
  "a change no unit test folder reaches runs no unit test",
  testsFor({ map: mapOf([]), related: [], inventory, changed: ["GLOSSARY.md"] }),
  { files: [], reach: 0 },
)
const wide = testsFor({ map: mapOf(["packages/document/", "tests/"]), related: document, inventory, changed: [] })
same(
  "a wide reach runs as many files as fit the seconds budget, each at 1 s plus half its recorded seconds, and leaves the rest to ci",
  [wide.files.length, wide.reach],
  [unitSecondsBudget, 301],
)
const timed = Object.fromEntries(document.map((file, at) => [file, at < 290 ? 2 : 0]))
same(
  "recorded seconds let the budget take the cheap files first",
  testsFor({ map: mapOf(["packages/document/"]), related: document, inventory, changed: [], seconds: timed }).files,
  [...document.slice(0, 2), ...document.slice(290)],
)
same(
  "tests in the pack a change sits in, then in packs that reach it, fill the budget before cheaper tests further away",
  testsFor({
    map: mapOf(["packages/document/"]),
    related: document,
    inventory,
    changed: [],
    seconds: timed,
    distance: (file) => (file.endsWith("t005.test.ts") || file.endsWith("t006.test.ts") ? 0 : 1),
  }).files,
  [...document.slice(5, 7), ...document.slice(290)],
)
same(
  "a changed test file in the reach always runs, even past the budget",
  testsFor({
    map: mapOf(["packages/document/"]),
    related: [],
    inventory,
    changed: ["packages/document/src/t299.test.ts", "packages/document/src/x.ts"],
    seconds: { "packages/document/src/t299.test.ts": 99 },
  }).files,
  ["packages/document/src/t299.test.ts"],
)
same(
  "when the map runs everything, the gate runs the changed test files and leaves the suite to ci",
  testsFor({
    map: mapOf("all"),
    related: document,
    inventory,
    changed: ["tests/edit-replay.test.ts", "pnpm-lock.yaml"],
  }),
  { files: ["tests/edit-replay.test.ts"], reach: 302 },
)
same(
  "the end names what only ci runs: the unit files left out and each part the map turned on",
  ciAlsoRuns(mapOf(["packages/document/"], { source: true, browser: true, journeys: true, scripts: false }), 75, 301),
  ["226 more unit test files the change reaches", "the browser tests (4 jobs)", "the journeys"],
)
same("a run of everything names why", ciAlsoRuns(mapOf("all", {}), 1, 302), [
  "every part, because pnpm-lock.yaml changes how every part runs",
  "301 more unit test files the change reaches",
])
same("a docs change leaves only the scripts part to ci", ciAlsoRuns(mapOf([], { source: true, scripts: true }), 0, 0), [
  "every script test and the site build",
])
same("no Vitest cache records nothing", recordedSeconds("/nowhere"), {})

same(
  "each changed app or package folder is built, once, and a root file is not",
  packagesFor([
    "apps/web/src/editor/canvas.tsx",
    "apps/web/src/editor/toolbar.tsx",
    "packages/document/src/edit.ts",
    "pnpm-lock.yaml",
  ]),
  ["apps/web", "packages/document"],
)
same(
  "scripts, docs, specs and browser specs build nothing",
  packagesFor(["scripts/land.mjs", "AGENTS.md", "specs/undo/Undo.tla", "tests/browser/home.spec.ts"]),
  [],
)

const named = (chosen) => chosen.flatMap((stage) => stage.flatMap(stepsOf)).map(([name]) => name)
const cheap = checkSteps.cheapGateStages()
const preflight = [
  "test-imports",
  "format",
  "lint",
  "file-growth",
  "tsconfig-references",
  "lint-rules",
  "commit-authors",
  "package-boundaries",
  "unused-exports",
  "rule-rows",
  "linear-branch",
  "spec-timeouts",
  "cited-paths",
  "package-reads",
  "screen-pages",
]
const full = checkSteps.affectedGateStages({
  tests: ["a.test.ts"],
  tooling: ["scripts/land.test.mjs"],
  packages: ["apps/web", "packages/render"],
})
same("the cheap checks are the steps that wait for nothing, and the worktree sweep", named(cheap), [
  ...preflight,
  "actionlint",
  "copy-in-tests",
  "sweep-list",
])
same("then the gate builds and tests what the diff reaches", named(full), ["build", "unit-tests", "script-tests"])
for (const name of [
  "browser-tests",
  "model-check",
  "spec-coverage",
  "bar",
  "metrics",
  "design-findings",
  "site-build",
]) {
  if ([...named(cheap), ...named(full)].includes(name)) throw new Error(`the gate runs ${name}, which ci runs`)
}
const ofName = (chosen, name) =>
  chosen
    .flat()
    .flatMap(stepsOf)
    .find(([each]) => each === name)
same(
  "the build covers each changed folder and what depends on it, one package at a time, since each tsc -b writes the dist it references",
  ofName(full, "build"),
  [
    "build",
    "pnpm",
    [
      "--workspace-concurrency=1",
      "--filter",
      "...{./apps/web}",
      "--filter",
      "...{./packages/render}",
      "-r",
      "--if-present",
      "run",
      "build",
    ],
  ],
)
const testStep = ofName(checkSteps.stagesFor("all", false), "unit-tests")
same(
  "the unit-tests step runs only the chosen files, niced on two workers, with the unit-tests step's settings",
  ofName(full, "unit-tests"),
  ["unit-tests", "nice", ["-n", "10", testStep[1], "scripts/selected-unit-tests.mjs", "2", "a.test.ts"], testStep[3]],
)
same("the script-tests step runs only the chosen files", ofName(full, "script-tests"), [
  "script-tests",
  "node",
  ["scripts/tooling-tests.mjs", "scripts/land.test.mjs"],
])
same(
  "a docs change runs the cheap checks alone",
  checkSteps.affectedGateStages({ tests: [], tooling: [], packages: [] }),
  [],
)

const gateOf = async (failing, all = false) => {
  const events = []
  let stamped = 0
  const result = await runGate({
    later: async () => {
      events.push("choose")
      return checkSteps.affectedGateStages({ tests: ["a.test.ts"], tooling: [], packages: ["apps/web"] })
    },
    all,
    run: async ([name]) => {
      events.push(name)
      return name === failing ? 1 : 0
    },
    stamp: () => {
      stamped += 1
    },
  })
  return { events, stamped, failed: result.failed }
}
const passed = await gateOf(undefined)
same("a passing gate stamps the commit once", passed.stamped, 1)
same("the gate starts choosing its tests before the cheap checks run, so the two overlap", passed.events[0], "choose")
same(
  "the cheap checks run before anything slower",
  passed.events.slice(1, preflight.length + 1).sort(),
  [...preflight].sort(),
)
for (const failing of ["format", "lint", "file-growth"]) {
  const early = await gateOf(failing)
  same(`a ${failing} failure stamps nothing`, early.stamped, 0)
  same(
    `and runs nothing slower after ${failing}`,
    early.events.filter((name) => name !== "choose").sort(),
    [...preflight].sort(),
  )
}
for (const failing of ["build", "unit-tests", "actionlint", "copy-in-tests"]) {
  const late = await gateOf(failing)
  same(`a ${failing} failure stamps nothing`, [late.stamped, late.failed], [0, [failing]])
}
same(
  "--all runs every step after a cheap failure and still stamps nothing",
  await gateOf("format", true).then(({ events, stamped }) => [events.includes("unit-tests"), stamped]),
  [true, 0],
)

let unchosen = ""
try {
  await runGate({
    later: async () => {
      throw new Error("prove --plan crashed")
    },
    run: async () => 0,
    stamp: () => {
      throw new Error("a gate that chose nothing stamped")
    },
  })
} catch (error) {
  unchosen = error.message
}
same("a gate that cannot choose its tests fails and stamps nothing", unchosen, "prove --plan crashed")

console.log("gate tests passed")

if (!named(cheap).includes("unused-exports")) throw new Error("unused package exports must stop the gate")

const reported = []
let reportStamp = 0
await runGate({
  later: async () => full,
  run: async (step) => {
    reported.push(step)
    return 0
  },
  stamp: () => {
    reportStamp += 1
  },
  report: async () => {
    throw new Error("deliberate report failure")
  },
})
const unreported = []
await runGate({
  later: async () => full,
  run: async (step) => {
    unreported.push(step)
    return 0
  },
  stamp: () => {},
})
same("even a crashed report changes no chosen step", reported, unreported)
same("a crashed report cannot change push eligibility", reportStamp, 1)

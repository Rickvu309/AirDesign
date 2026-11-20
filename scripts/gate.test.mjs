import { stepsOf } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"
import { packagesFor, runGate, testsFor } from "./gate.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const planWith = (tests) => ({
  steps:
    tests === undefined
      ? []
      : [{ kind: "unit-tests", tests, files: ["x.ts"], because: "package.json is read outside the import graph" }],
})
const many = Array.from({ length: 599 }, (_, at) => `t${String(at)}.test.ts`)
same(
  "a diff reaching 599 unit files runs the changed test and names the ci remainder",
  testsFor({ plan: planWith("related"), related: many, changed: ["t3.test.ts", "core.ts"] }),
  { files: ["t3.test.ts"], ci: "598 more test files reach this diff" },
)
same(
  "a whole-suite plan runs the changed unit test and names why ci runs the suite",
  testsFor({
    plan: planWith("all"),
    related: [],
    inventory: many,
    changed: ["t5.test.ts", "package.json", "scripts/gate.test.mjs"],
  }),
  { files: ["t5.test.ts"], ci: "every unit test, because package.json is read outside the import graph" },
)
same("a diff with no unit reach runs no unit test", testsFor({ plan: planWith(), related: [], changed: [] }), {
  files: [],
  ci: undefined,
})
const atLimit = many.slice(0, 40)
same("all 40 reached files run", testsFor({ plan: planWith("related"), related: atLimit, changed: ["core.ts"] }), {
  files: atLimit,
  ci: undefined,
})
same(
  "Vitest reach applies to script inputs too",
  testsFor({ plan: planWith(), related: atLimit, changed: ["scripts/input.mjs"] }),
  { files: atLimit, ci: undefined },
)

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

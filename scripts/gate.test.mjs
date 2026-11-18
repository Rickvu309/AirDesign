import { stepsOf } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"
import { packagesFor, runGate, testLimit, testsFor } from "./gate.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const planWith = (tests) => ({
  steps:
    tests === undefined
      ? []
      : [{ kind: "unit", tests, files: ["x.ts"], because: "package.json is read outside the import graph" }],
})
same(
  "a diff with no unit source runs no unit test",
  testsFor({ plan: planWith(), related: ["a.test.ts"], changed: ["AGENTS.md"] }),
  { files: [], ci: undefined },
)
const few = ["a.test.ts", "b.test.ts"]
same(
  "every test file a diff reaches runs while they are few",
  testsFor({ plan: planWith("related"), related: few, changed: ["a.ts"] }),
  { files: few, ci: undefined },
)
const many = Array.from({ length: testLimit + 1 }, (_, at) => `t${String(at)}.test.ts`)
same(
  "past the limit only the changed test files run, and ci runs the rest",
  testsFor({ plan: planWith("related"), related: many, changed: ["t3.test.ts", "core.ts"] }),
  { files: ["t3.test.ts"], ci: `${String(testLimit)} more test files reach this diff` },
)
same(
  "a file read outside the import graph runs only the changed test files, and ci runs every unit test",
  testsFor({ plan: planWith("all"), related: few, changed: ["b.test.ts", "package.json"] }),
  { files: ["b.test.ts"], ci: "every unit test, because package.json is read outside the import graph" },
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
  "browser-imports",
  "format",
  "lint",
  "file-size",
  "references",
  "bug-rule",
  "commit-authors",
  "boundaries",
  "interface-width",
]
const full = checkSteps.affectedGateStages({
  tests: ["a.test.ts"],
  tooling: ["scripts/land.test.mjs"],
  packages: ["apps/web", "packages/render"],
})
same("the cheap checks are the steps that wait for nothing, and the worktree sweep", named(cheap), [
  ...preflight,
  "actionlint",
  "copy-literals",
  "worktrees",
])
same("then the gate builds and tests what the diff reaches", named(full), ["build", "test", "tooling"])
for (const name of ["browser", "specs", "spec-replays", "bar", "metrics", "design-findings", "site"]) {
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
const testStep = ofName(checkSteps.stagesFor("all", false), "test")
same(
  "the test step runs only the chosen files, niced on two workers, with the test step's settings",
  ofName(full, "test"),
  ["test", "nice", ["-n", "10", testStep[1], ...testStep[2], "--maxWorkers=2", "a.test.ts"], testStep[3]],
)
same("the tooling step runs only the chosen files", ofName(full, "tooling"), [
  "tooling",
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
for (const failing of ["format", "lint", "file-size"]) {
  const early = await gateOf(failing)
  same(`a ${failing} failure stamps nothing`, early.stamped, 0)
  same(
    `and runs nothing slower after ${failing}`,
    early.events.filter((name) => name !== "choose").sort(),
    [...preflight].sort(),
  )
}
for (const failing of ["build", "test", "actionlint", "copy-literals"]) {
  const late = await gateOf(failing)
  same(`a ${failing} failure stamps nothing`, [late.stamped, late.failed], [0, [failing]])
}
same(
  "--all runs every step after a cheap failure and still stamps nothing",
  await gateOf("format", true).then(({ events, stamped }) => [events.includes("test"), stamped]),
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

if (!named(cheap).includes("interface-width")) throw new Error("unused package exports must stop the gate")

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

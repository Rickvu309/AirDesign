import assert from "node:assert/strict"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { stepsOf } from "./check.mjs"
import { changesFrom, checkSteps, defineCheckSteps, everyChange, unitTestsIn } from "./check-steps.mjs"
import { ruleFiles } from "./rules.mjs"

const row = { name: "planted", kind: "rule", command: "node" }
const planted = defineCheckSteps([row])
const only = [[["planted", "node", []]]]
assert.deepEqual(planted.parts(), ["source"])
assert.deepEqual(planted.stagesFor("all", false), only)
assert.deepEqual(planted.stagesFor("source", true), only)
assert.deepEqual(planted.stagesFor("scripts", true), [])
assert.deepEqual(planted.cheapGateStages(), [])
assert.deepEqual(planted.affectedGateStages({}), [])
assert.equal(planted.isPreflight("planted"), false)
assert.equal(planted.showsOutput("planted"), false)
assert.equal(planted.stepLimit("planted", false), 480)
assert.equal(planted.stepLimit("planted", true), 1200)
assert.equal(planted.mayPush(["planted"], true), false)
assert.equal(planted.stampable(["planted"], true), false)
assert.equal(planted.rerunsAlone("planted"), false)
for (const event of ["", "pull_request", "merge_group", "push"]) assert.equal(planted.warns("planted", event), false)
const afterPr = defineCheckSteps([{ ...row, verdict: "warn-after-pr" }])
for (const [event, warns] of [
  ["", false],
  ["pull_request", false],
  ["merge_group", true],
  ["push", true],
])
  assert.equal(afterPr.warns("planted", event), warns, `warn-after-pr on ${event || "this machine"}`)
assert.equal(checkSteps.warns("file-growth", "push"), true, "file-growth warns on a push to main with no queue run")
assert.equal(checkSteps.warns("file-growth", "pull_request"), false, "file-growth blocks on a pull request")

const anotherStage = { ...row, name: "summary", part: "scripts", after: "work" }
const withAnotherStage = defineCheckSteps([row, anotherStage])
assert.deepEqual(withAnotherStage.stagesFor("all", true), [...only, [["summary", "node", []]]])
assert.deepEqual(withAnotherStage.stagesFor("scripts", true), [[["summary", "node", []]]])
assert.deepEqual(withAnotherStage.stagesFor("source", true), only)

const kinds = ["rule", "tests", "build", "report"]
for (const ci of [false, true]) {
  const steps = checkSteps.stagesFor("all", ci).flatMap((stage) => stage.flatMap(stepsOf))
  for (const [name] of steps) {
    assert.ok(kinds.includes(checkSteps.kindOf(name)), `give ${name} exactly one kind`)
  }
}

for (const [change, fix] of [
  [{ name: "planted!" }, "give the step a lowercase name"],
  [{ kind: ["rule", "tests"] }, "set kind to rule, tests, build, or report"],
  [{ command: undefined }, "set command to an executable"],
  [{ part: [] }, "name one or more distinct parts, or use all"],
  [{ where: "remote" }, "set where to everywhere, local, or ci"],
  [{ verdict: "ignore" }, "set verdict to block, warn, or warn-after-pr"],
  [{ kind: "report", verdict: "block" }, "remove verdict from the report"],
  [{ where: "ci", gate: { order: 1 } }, "remove gate or allow this step locally"],
  [{ preflight: true, lane: "outputs" }, "remove preflight or run outside the lane and stage barrier"],
  [{ preflight: true, after: "work" }, "remove preflight or run outside the lane and stage barrier"],
  [{ preflight: true, gate: { order: 1, select: () => [] } }, "remove preflight or select this step in the cheap gate"],
  [{ after: "missing" }, "set after to work or omit it"],
  [{ gate: { order: 0 } }, "give gate a positive integer order"],
  [{ gate: { order: 1, select: "tests" } }, "make gate.select a function"],
  [{ rerunAlone: true }, "give a rerun a gate selector on a test judged on ci"],
  [{ stampOnFailure: true }, "set judgedOnCi to allow a stamp after failure"],
]) {
  assert.throws(() => defineCheckSteps([{ ...row, ...change }]), { message: `${change.name ?? row.name}: ${fix}.` })
}
assert.throws(() => defineCheckSteps([row, row]), { message: "planted: give each step a unique name." })
assert.throws(
  () =>
    defineCheckSteps([
      { ...row, gate: { order: 1 } },
      { ...row, name: "other", gate: { order: 1 } },
    ]),
  { message: "other: give each gate step in this phase a unique order." },
)

const rerunnable = { ...row, kind: "tests", judgedOnCi: true, rerunAlone: true }
assert.throws(
  () =>
    defineCheckSteps([
      { ...rerunnable, gate: { order: 1, select: () => undefined } },
      { ...rerunnable, name: "other", gate: { order: 2, select: () => undefined } },
    ]),
  { message: "other: give only one gate step a rerun." },
)

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
const workflow = parse(read(".github/workflows/ci.yml"))
const question = parse(read(".github/actions/queued/action.yml")).runs.steps[0]
const checkJobs = JSON.parse(workflow.jobs.changes.steps.find((step) => step.id === "map").with["check-jobs"])
const matrixParts = [...new Set(checkJobs.map(({ part }) => part))]
const calledParts = fs
  .readdirSync(new URL("../.github/workflows/", import.meta.url))
  .flatMap((file) => [...read(`.github/workflows/${file}`).matchAll(/pnpm check --part=([\w-]+)$/gm)])
  .map(([, part]) => part)
const ranParts = [...matrixParts, ...calledParts]
assert.deepEqual(ranParts.toSorted(), [...checkSteps.parts(), "pptx"].toSorted(), "ci.yml parts")
const queueScript = question.run
const queueCase = queueScript.match(/case "\$PART" in([\s\S]*?)^\s*esac/m)?.[1] ?? ""
const queueParts = [
  ...Array.from(queueScript.matchAll(/\[ "\$PART" (?:=|!=) ([\w-]+) \]/g), ([, part]) => part),
  ...Array.from(queueCase.matchAll(/^\s*([\w-]+(?:\s*\|\s*[\w-]+)*)\)/gm), ([, parts]) =>
    parts.split(/\s*\|\s*/),
  ).flat(),
]
assert.deepEqual([...new Set(queueParts)].toSorted(), [...matrixParts, "corpus"].toSorted(), "queued/action.yml parts")

const ciParts = [...JSON.stringify(workflow).matchAll(/matrix\.part\s*[!=]=\s*'([\w-]+)'|--part=([\w-]+)/g)].map(
  ([, comparison, flag]) => comparison ?? flag,
)
assert.deepEqual(
  ciParts.filter((part) => !matrixParts.includes(part)),
  [],
  "ci.yml conditions and commands name declared parts",
)
for (const file of ["CHECKS.md", "COMMANDS.md", ...ruleFiles(fileURLToPath(new URL("..", import.meta.url)))]) {
  const docs = read(file)
  const steps = [...docs.matchAll(/step `([\w-]+)`|`([\w-]+)` step\b/g)].map(([, before, after]) => before ?? after)
  const parts = [...docs.matchAll(/part `([\w-]+)`|`([\w-]+)` part\b|--part=([\w-]+)/g)].map(
    ([, before, after, flag]) => before ?? after ?? flag,
  )
  assert.deepEqual(
    [
      ...steps.filter((name) => checkSteps.kindOf(name) === undefined),
      ...parts.filter((part) => !ranParts.includes(part)),
    ],
    [],
    `${file} names declared steps and parts`,
  )
}

assert.deepEqual(
  ["", "all", "[", "{}", '[""]', "[1]", undefined].map(
    (value) => changesFrom({ AIRDESIGN_UNIT_TESTS: value }).unitTests,
  ),
  Array(7).fill("all"),
  "a missing or unreadable unit test list runs every unit test",
)
assert.deepEqual(changesFrom({ AIRDESIGN_UNIT_TESTS: '["apps/web/"]' }).unitTests, ["apps/web/"])
assert.deepEqual(changesFrom({ AIRDESIGN_UNIT_TESTS: "[]" }).unitTests, [])
assert.deepEqual(
  ["", "true", undefined, "false"].map((value) => changesFrom({ AIRDESIGN_MODEL_CHECK: value }).modelCheck),
  [true, true, true, false],
  "only a model check changes said false skips the specs",
)
assert.deepEqual(changesFrom({}), everyChange)
assert.deepEqual(
  unitTestsIn(
    ["tests/", "packages/oauth/"],
    [
      "apps/web/tests/a.test.ts",
      "packages/oauth/src/grant.test.ts",
      "packages/oauth-extra/src/b.test.ts",
      "tests/edit-replay.test.ts",
    ],
  ),
  ["packages/oauth/src/grant.test.ts", "tests/edit-replay.test.ts"],
  "a folder holds only the files under it, matched from the start of the path",
)
const sourceSteps = (changes) =>
  checkSteps
    .stagesFor("source", true, undefined, changes)
    .flat()
    .flatMap(stepsOf)
    .filter(([name]) => name === "unit-tests" || name === "model-check")
    .map(([name, , args]) => [name, args.slice(2)])
assert.deepEqual(
  sourceSteps(everyChange),
  [
    ["unit-tests", []],
    ["model-check", []],
  ],
  "a run of everything runs the whole unit suite and the model check",
)
const oauthTests = unitTestsIn(["packages/oauth/"])
assert.ok(oauthTests.length > 0)
assert.deepEqual(
  sourceSteps({ unitTests: ["packages/oauth/"], modelCheck: false }),
  [["unit-tests", oauthTests]],
  "the source part runs only the unit test files in the folders changes chose, and no model check when changes said false",
)
assert.deepEqual(
  sourceSteps({ unitTests: [], modelCheck: true }),
  [["model-check", []]],
  "a change no unit test folder reaches runs no unit test",
)
assert.throws(() => defineCheckSteps([{ ...row, narrow: "yes" }]), {
  message: "planted: make narrow a function on a step outside the preflight and the lanes.",
})

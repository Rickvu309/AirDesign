import assert from "node:assert/strict"
import fs from "node:fs"
import { parse } from "yaml"
import { stepsOf } from "./check.mjs"
import { checkSteps, defineCheckSteps } from "./check-steps.mjs"

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
assert.equal(planted.stepLimit("planted", true), undefined)
assert.equal(planted.mayPush(["planted"], true), false)
assert.equal(planted.stampable(["planted"], true), false)
assert.equal(planted.rerunsAlone("planted"), false)
for (const event of ["", "pull_request", "merge_group", "push"]) assert.equal(planted.warns("planted", event), false)

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
  [{ verdict: "ignore" }, "set verdict to block, warn, or warn-in-queue"],
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
const matrixParts = [...new Set(workflow.jobs.check.strategy.matrix.include.map(({ part }) => part))]
assert.deepEqual(matrixParts.toSorted(), [...checkSteps.parts(), "pptx"].toSorted(), "ci.yml parts")
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
for (const file of ["CHECKS.md", "COMMANDS.md"]) {
  const docs = read(file)
  const steps = [...docs.matchAll(/step `([\w-]+)`|`([\w-]+)` step\b/g)].map(([, before, after]) => before ?? after)
  const parts = [...docs.matchAll(/part `([\w-]+)`|`([\w-]+)` part\b|--part=([\w-]+)/g)].map(
    ([, before, after, flag]) => before ?? after ?? flag,
  )
  assert.deepEqual(
    [
      ...steps.filter((name) => checkSteps.kindOf(name) === undefined),
      ...parts.filter((part) => !matrixParts.includes(part)),
    ],
    [],
    `${file} names declared steps and parts`,
  )
}

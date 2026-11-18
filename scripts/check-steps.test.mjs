import assert from "node:assert/strict"
import { stepsOf } from "./check.mjs"
import { checkSteps, defineCheckSteps } from "./check-steps.mjs"

const row = { name: "planted", kind: "rule", command: "node" }
const planted = defineCheckSteps([row])
const only = [[["planted", "node", []]]]
assert.deepEqual(planted.parts(), ["main"])
assert.deepEqual(planted.stagesFor("all", false), only)
assert.deepEqual(planted.stagesFor("main", true), only)
assert.deepEqual(planted.stagesFor("side", true), [])
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

const anotherStage = { ...row, name: "summary", part: "side", after: "work" }
const withAnotherStage = defineCheckSteps([row, anotherStage])
assert.deepEqual(withAnotherStage.stagesFor("all", true), [...only, [["summary", "node", []]]])
assert.deepEqual(withAnotherStage.stagesFor("side", true), [[["summary", "node", []]]])
assert.deepEqual(withAnotherStage.stagesFor("main", true), only)

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

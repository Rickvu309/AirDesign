import assert from "node:assert/strict"
import fs from "node:fs"
import { parse } from "yaml"

const read = (file) => parse(fs.readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8"))
const ci = read("ci.yml")
const bar = read("bar.yml")
const report = read("ci-failure-report.yml")

const onlyInQueue = (condition) =>
  typeof condition === "string" &&
  /github\.event_name == 'merge_group'|workflow_run\.event == 'merge_group'/.test(condition) &&
  !/github\.event_name == 'push'/.test(condition)

const queueOnly = (workflow) =>
  Object.entries(workflow.jobs).flatMap(([job, { if: jobIf, steps = [] }]) => [
    ...(onlyInQueue(jobIf) ? [`${job}`] : []),
    ...steps
      .filter((step) => onlyInQueue(step.if))
      .map((step) => `${job}: ${step.name ?? step.with?.name ?? step.uses}`),
  ])

assert.deepEqual(
  queueOnly(ci),
  ["check: spec-results"],
  "a ci step that runs only in the merge queue would stop silently with no queue: give it a push duty below",
)

const steps = (job) => ci.jobs[job].steps
const savesOnPush = (job, cachePath) =>
  steps(job).some(
    (step) =>
      step.uses?.startsWith("actions/cache/save@") &&
      step.with?.path === cachePath &&
      !/== 'merge_group'/.test(step.if ?? "") &&
      /needed == 'true'/.test(step.if ?? ""),
  )
assert.equal(
  savesOnPush("check", "~/.cache/airdesign/spec-results"),
  true,
  "with no queue run, the push run on main saves the spec results the queue used to hand it",
)
const timing = ci.jobs.ci.steps.find((step) => step.name === "ci-duration")
assert.equal(timing.if, "github.event_name != 'pull_request' && needs.changes.outputs.queued != 'true'")

const [barJob] = Object.values(bar.jobs)
assert.equal(
  barJob.steps.filter((step) => step.if === "github.event_name != 'merge_group'").length,
  2,
  "bar judges every pull request on pull_request_target, so with no queue it still runs before the merge",
)
assert.deepEqual(Object.keys(bar.on), ["pull_request_target", "merge_group"])

assert.deepEqual(
  queueOnly(report),
  ["queue-drop"],
  "only the queue-drop comment is queue-only: with no queue, pnpm land reports a failed pull request run itself",
)
assert.equal(report.jobs["ci-failure-report"].if.includes("workflow_run.event == 'push'"), true)

console.log("queue-free: all assertions passed")

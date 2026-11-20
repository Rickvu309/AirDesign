import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { stepsOf } from "./check.mjs"
import { checkSteps, designShardCount, designShardVariable, shardOf, statesPerDesignShard } from "./check-steps.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

let failures = 0
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++
    console.error(`FAIL ${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const steps = workflow.jobs.check.steps
const stateCount = fs
  .readdirSync(path.join(root, ".agents/skills/verify-airdesign/look/states"))
  .filter((file) => file.endsWith(".mjs")).length
const designShards = designShardCount(stateCount)
const checkJobsFile = workflow.jobs.changes.steps.find((step) => step.id === "map").with["check-jobs-file"]
const designEntries = JSON.parse(fs.readFileSync(path.join(root, checkJobsFile), "utf8")).filter(
  (entry) => entry.part === "design",
)
same("a design shard is sized from the count of states", [1, 200, 201, 400, 401].map(designShardCount), [1, 1, 2, 2, 3])
same(
  `the design scans run in one check job per ${statesPerDesignShard} states, ${designShards} for ${stateCount} states`,
  designEntries.map((entry) => entry.shard),
  Array.from({ length: designShards }, (_, index) => `${index + 1}/${designShards}`),
)

const browserStep = (shard) =>
  checkSteps
    .stagesFor("design", true, shard)
    .flat()
    .flatMap(stepsOf)
    .find(([name]) => name === "browser-tests")
same(
  "every design shard runs both design scans, each over its own share of the states and screens",
  designEntries.map((entry) => {
    const [, , args, env] = browserStep(shardOf([`--shard=${entry.shard}`]))
    return [args, env?.[designShardVariable]]
  }),
  designEntries.map((entry) => [browserStep()[2], entry.shard]),
)

const kept = steps.find((step) => (step.with?.name ?? "").startsWith("browser-timings-"))
same(
  "each design shard keeps its design reports beside its timings, even when its browser tests fail",
  [
    kept?.if.startsWith("!cancelled() && steps.work.outputs.needed == 'true'"),
    kept?.if.includes("matrix.part == 'design'"),
    kept?.with.path,
    kept?.with.name,
  ],
  [true, true, "test-results/*.json", "browser-timings-${{ matrix.part }}-${{ strategy.job-index }}"],
)

const caller = workflow.jobs["design-findings"]
same(
  "design-findings waits for every design shard, on pull requests whose change reaches the design scans",
  [caller?.needs, caller?.if, caller?.uses],
  [
    ["changes", "check"],
    "${{ !cancelled() && github.event_name == 'pull_request' && needs.changes.outputs.design != 'false' }}",
    "./.github/workflows/design-findings.yml",
  ],
)
const called = parse(fs.readFileSync(path.join(root, ".github/workflows/design-findings.yml"), "utf8"))
same("design-findings runs only when ci calls it", Object.keys(called.on), ["workflow_call"])
const findingsSteps = called.jobs["design-findings"]?.steps ?? []
const gathered = findingsSteps.find((step) => (step.uses ?? "").startsWith("actions/download-artifact"))
same(
  "design-findings gathers every design shard's reports into one folder, and a lost report fails its judgment, not the download",
  [gathered?.with, gathered?.["continue-on-error"]],
  [{ pattern: "browser-timings-design-*", path: "test-results", "merge-multiple": true }, true],
)
same(
  "design-findings sets up what pnpm check needs, gathers the reports and then judges them",
  findingsSteps.map((step) => (step.uses ?? step.run).split("@")[0]),
  [
    "actions/checkout",
    "pnpm/action-setup",
    "actions/setup-node",
    "pnpm install --frozen-lockfile",
    "actions/download-artifact",
    "pnpm check --part=findings",
  ],
)
same(
  "ci does not wait for design-findings, which warns and blocks nothing",
  workflow.jobs.ci.needs.includes("design-findings"),
  false,
)
if (failures > 0) process.exit(1)
console.log("design-shards: all assertions passed")

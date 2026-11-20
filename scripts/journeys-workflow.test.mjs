import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

let failures = 0
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++
    console.error(`FAIL ${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const read = (file) => parse(fs.readFileSync(path.join(root, file), "utf8"))
const ci = read(".github/workflows/ci.yml")
const journeysFile = read(".github/workflows/journeys.yml")
const job = journeysFile.jobs.journeys
const run = job.steps.find((step) => step.run === "pnpm test:journeys")

same(
  "ci passes the selected journey names",
  ci.jobs.journeys.with["journey-names"],
  "${{ needs.changes.outputs.journey-names }}",
)
same("the workflow takes the selected journey names", Object.keys(journeysFile.on.workflow_call.inputs), [
  "journey-names",
])
same("each journey shard keeps running if another fails", job.strategy["fail-fast"], false)
same("the journey runner gets the selected names", run.env.JOURNEYS_CHANGED, "${{ inputs.journey-names }}")
same("the journey runner gets its own shard", run.env.JOURNEYS_SHARD.includes("matrix.shard"), true)
same(
  "each shard has its own failure artifact",
  job.steps.find((step) => step.if === "failure()").with.name.includes("matrix.shard"),
  true,
)
same("a change that names journeys runs one shard", job.strategy.matrix.shard.includes("'[1]'"), true)
if (failures > 0) process.exit(1)
console.log("journeys-workflow: all assertions passed")

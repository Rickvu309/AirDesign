import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workflowFile = path.join(root, ".github/workflows/ci.yml")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const workflow = parse(fs.readFileSync(workflowFile, "utf8"))
const mutation = workflow.jobs.mutation.steps.find((step) => (step.run ?? "").includes("scripts/check-mutation.mjs"))
const command = "node scripts/check-mutation.mjs --changed-from HEAD^1"
same("the mutation step runs the mutation check once", mutation.run.split(command).length, 2)

const exitOf = (code) =>
  spawnSync("bash", ["-e", "-c", mutation.run.replace(/timeout [^\n|]*check-mutation\.mjs[^\n|]*/, `(exit ${code})`)], {
    encoding: "utf8",
  }).status

same("a mutation run that finished passes its step", exitOf(0), 0)
same("a mutation run that crashed fails its step", exitOf(1), 1)
same("a mutation run that hit its time limit warns and passes", [exitOf(124), exitOf(137)], [0, 0])

const fixturePath = path.join(root, "scripts/land-fixtures/job-mutation-dry-run-timeout.log")
const printing = (file, code) =>
  spawnSync(
    "bash",
    [
      "-e",
      "-c",
      mutation.run.replace(
        /timeout [^\n|]*check-mutation\.mjs[^\n|]*/,
        `(cat ${JSON.stringify(file)}; exit ${code}) > "$log" 2>&1`,
      ),
    ],
    { encoding: "utf8" },
  )
const timedOut = printing(fixturePath, 1)
same("a first run of the tests that hit Stryker's time limit warns and passes", timedOut.status, 0)
same(
  "a first run that hit its time limit still prints what it found",
  timedOut.stdout.includes("Initial test run timed out!"),
  true,
)
const crashLog = path.join(root, "scripts/land-fixtures/job-mutation-test-runner-crashed.log")
same("a first run whose test runner crashed fails its step", printing(crashLog, 1).status, 1)

const paintWorkflow = parse(fs.readFileSync(path.join(root, ".github/workflows/paint-fidelity.yml"), "utf8"))
const paint = paintWorkflow.jobs["paint-fidelity"].steps.find((step) => step.name === "paint-fidelity")
same("a paint-fidelity run that fails fails its job", paint["continue-on-error"], undefined)
same(
  "a paint-fidelity job that fails fails its workflow",
  paintWorkflow.jobs["paint-fidelity"]["continue-on-error"],
  undefined,
)

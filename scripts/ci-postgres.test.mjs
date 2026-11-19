import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { stepsOf } from "./check.mjs"
import { checkSteps } from "./check-steps.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = path.join(root, ".github/workflows")
const workflows = fs
  .readdirSync(folder)
  .filter((name) => name.endsWith(".yml"))
  .map((name) => ({ name, jobs: parse(fs.readFileSync(path.join(folder, name), "utf8")).jobs }))
const jobs = workflows.flatMap(({ name, jobs: found }) =>
  Object.entries(found).map(([job, { steps = [] }]) => ({ name: `${name} ${job}`, steps })),
)
const partRunsTests = (part) =>
  checkSteps
    .stagesFor(part, true)
    .flat()
    .flatMap(stepsOf)
    .some(([name]) => ["unit-tests", "script-tests", "browser-tests"].includes(name))
const needsPostgres = (step) => {
  const part = (step.run ?? "").match(/pnpm check --part=([\w-]+)$/)?.[1]
  return (
    /pnpm (check --part=\$|check:pptx|metric:paint-fidelity|test:journeys)|check-mutation\.mjs/.test(step.run ?? "") ||
    (part !== undefined && partRunsTests(part))
  )
}
const action = "./.github/actions/postgres"

same(
  "no workflow installs PostgreSQL from a package mirror",
  jobs.filter(({ steps }) => steps.some((step) => /apt-get[^\n]*install[^\n]*postgresql/.test(step.run ?? ""))),
  [],
)
const served = jobs.filter(({ steps }) => steps.some(needsPostgres))
same("the jobs that run the database tests are found", served.map(({ name }) => name).sort(), [
  "ci.yml check",
  "ci.yml corpus",
  "ci.yml mutation",
  "journeys.yml journeys",
  "paint-fidelity.yml paint-fidelity",
])
for (const { name, steps } of served) {
  const at = steps.findIndex((step) => step.uses === action)
  same(`${name} gets PostgreSQL from the one action`, at !== -1, true)
  same(`${name} gets PostgreSQL before it runs the tests`, at < steps.findIndex(needsPostgres), true)
}

const steps = parse(fs.readFileSync(path.join(root, ".github/actions/postgres/action.yml"), "utf8")).runs.steps
const cache = steps.find((step) => (step.uses ?? "").startsWith("actions/cache@"))
same("the action keeps PostgreSQL where the tests look for it", cache.with.path, "~/.local/pgsql-18")
same("a changed install script makes a new copy", cache.with.key.includes("hashFiles('scripts/postgres.sh')"), true)
const install = steps.find((step) => step.run === "bash scripts/postgres.sh")
same("the action installs only when the copy is missing", install.if, "steps.postgres.outputs.cache-hit != 'true'")
same("the cache step is the one the install reads", cache.id, "postgres")

const corpus = parse(fs.readFileSync(path.join(folder, "ci.yml"), "utf8")).jobs.corpus
same("both corpus shards get the database before judging", corpus.strategy.matrix.shard, [1, 2])
same(
  "corpus passes its shard to the judge",
  corpus.steps.find(needsPostgres).run,
  "pnpm check:pptx:corpus --shard=${{ matrix.shard }}/2",
)

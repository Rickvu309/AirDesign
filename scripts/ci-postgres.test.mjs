import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

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
const needsPostgres = (step) => /pnpm (check --part|test:journeys)|check-mutation\.mjs/.test(step.run ?? "")
const action = "./.github/actions/postgres"

same(
  "no workflow installs PostgreSQL from a package mirror",
  jobs.filter(({ steps }) => steps.some((step) => /apt-get[^\n]*install[^\n]*postgresql/.test(step.run ?? ""))),
  [],
)
const served = jobs.filter(({ steps }) => steps.some(needsPostgres))
same("the jobs that run the database tests are found", served.map(({ name }) => name).sort(), [
  "ci.yml check",
  "ci.yml mutation",
  "journeys.yml journeys",
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

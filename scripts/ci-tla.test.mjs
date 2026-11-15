import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"
import { tlaHash } from "./check-specs.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = path.join(root, ".github/workflows")
const jobs = fs
  .readdirSync(folder)
  .filter((name) => name.endsWith(".yml"))
  .flatMap((name) =>
    Object.entries(parse(fs.readFileSync(path.join(folder, name), "utf8")).jobs).map(([job, { steps = [] }]) => ({
      name: `${name} ${job}`,
      steps,
    })),
  )
const replaysSpecs = (step) => /pnpm check --part|check-mutation\.mjs/.test(step.run ?? "")
const action = "./.github/actions/tla"

const served = jobs.filter(({ steps }) => steps.some(replaysSpecs))
same("the jobs that replay the specs are found", served.map(({ name }) => name).sort(), [
  "ci.yml check",
  "ci.yml mutation",
])
for (const { name, steps } of served) {
  const at = steps.findIndex((step) => step.uses === action)
  same(`${name} gets the TLA+ tools from the one action`, at !== -1, true)
  same(`${name} gets the TLA+ tools before it replays the specs`, at < steps.findIndex(replaysSpecs), true)
}
same(
  "no workflow downloads the TLA+ tools itself",
  jobs.filter(({ steps }) => steps.some((step) => /tla2tools\.jar/.test(step.run ?? ""))).map(({ name }) => name),
  [],
)

const steps = parse(fs.readFileSync(path.join(root, ".github/actions/tla/action.yml"), "utf8")).runs.steps
const cache = steps.find((step) => (step.uses ?? "").startsWith("actions/cache@"))
same("the action keeps the jar where the replays look for it", cache.with.path, "~/.local/tla/tla2tools.jar")
same("the cache key names the jar the replays accept", cache.with.key, `tla2tools-${tlaHash}`)
const install = steps.find((step) => /curl/.test(step.run ?? ""))
same("the action downloads only when the jar is missing", install.if, `steps.${cache.id}.outputs.cache-hit != 'true'`)
same(
  "the download is checked against the hash the replays accept",
  install.run.includes(`${tlaHash}  $HOME/.local/tla/tla2tools.jar" | sha256sum -c`),
  true,
)

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { importParse } from "./import-parse.mjs"
import { caughtCount, readSeedList } from "./judge-proof.mjs"
import { judgedDecks } from "./pptx-corpus.mjs"
import { titleLimit } from "./title.mjs"
import { readRun } from "./vitest-metrics.mjs"

const seedListFile = (root) => path.join(root, "scripts/pptx-fixtures/judge-seeds.json")

const listedMisses = (root) =>
  fs.existsSync(seedListFile(root)) ? readSeedList(fs.readFileSync(seedListFile(root), "utf8")).known.length : 0

const browserSpecs = (root) => {
  const tests = path.join(root, "tests")
  if (!fs.existsSync(tests)) return []
  return fs
    .readdirSync(tests, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".spec.ts"))
    .map((entry) => path.join(entry.parentPath, entry.name))
}

export const browserFaults = (root) =>
  browserSpecs(root).reduce(
    (sum, file) => sum + (fs.readFileSync(file, "utf8").match(/\btest\.(fail|fixme|skip)\(/g) ?? []).length,
    0,
  )

const knownFailures = (root) => readRun(root).faults + listedMisses(root) + browserFaults(root)

const realDecks = (root) => judgedDecks(root).length

const built = (root, name) => {
  const entry = path.join(root, "packages", name, "dist/index.js")
  if (!fs.existsSync(entry)) throw new Error(`packages/${name} is not built. Run pnpm build, then run this again.`)
  return import(pathToFileURL(entry).href)
}

const routeNames = (table) =>
  Object.values(table).flatMap((routes) => Object.values(routes).map((named) => named.route))

const capabilitiesExported = async (root) => {
  const document = await built(root, "document")
  const pptx = await built(root, "pptx")
  return {
    now: new Set(Object.values(pptx.writtenRoutes)).size,
    goal: new Set([...routeNames(document.properties), ...routeNames(document.structure)]).size,
  }
}

const plantedBreaks = (root) =>
  caughtCount(JSON.parse(fs.readFileSync(path.join(root, "scripts/pptx-fixtures/judge-proof.json"), "utf8")))

export const longTitles = (titles) => titles.filter((title) => [...title].length > titleLimit).length

export const mainTitles = (root) => {
  try {
    return execFileSync("git", ["log", "-50", "--no-merges", "--format=%s", "origin/main", "--"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .filter((title) => title !== "")
  } catch {
    throw new Error("long-titles reads origin/main, which is missing. Run git fetch origin main.")
  }
}

export const measures = {
  "known-failures": knownFailures,
  "corpus-size": realDecks,
  "export-coverage": capabilitiesExported,
  "fault-detection": plantedBreaks,
  "long-titles": (root) => longTitles(mainTitles(root)),
  "import-parse": importParse,
}

export const measuredLive = new Set(["known-failures", "long-titles"])

export const timedMetrics = {
  "ci-duration": "scripts/check.mjs",
  "pptx-check-duration": "scripts/pptx-check.mjs",
}

export const judgedWrites = "export-verified"

const judgedBy = {
  [judgedWrites]: "scripts/pptx-check.mjs",
  "eval-coverage": "tests/eval-coverage.test.ts",
  "design-findings": "scripts/design-findings.mjs",
}

const record = (root) => JSON.parse(fs.readFileSync(path.join(root, "metrics.json"), "utf8"))

export const overLimit = ({ name, now, limit }) =>
  now > limit ? `${name} is ${now} and its limit is ${limit}. Make it faster.` : undefined

export const timeMetric = (root, name, started) => {
  const limit = record(root)[name]?.limit
  const now = Number(((Date.now() - started) / 1000).toFixed(1))
  if (typeof limit !== "number") throw new Error(`${name} has no limit in metrics.json.`)
  const over = overLimit({ name, now, limit })
  return { line: `metric ${name}  now ${now}  limit ${limit}`, over }
}

export const readMetrics = async (root, measuring = measures) => {
  const recorded = record(root)
  const rows = []
  const drift = []
  for (const [name, measure] of Object.entries(measuring)) {
    const metric = recorded[name]
    if (metric === undefined) {
      drift.push(`${name} is measured and missing from metrics.json.`)
      continue
    }
    const measured = await measure(root)
    if (measuredLive.has(name)) {
      rows.push({ name, now: measured, goal: metric.goal })
      continue
    }
    const { now, goal } = typeof measured === "number" ? { now: measured, goal: metric.goal } : measured
    rows.push({ name, now, goal })
    if (now !== metric.now)
      drift.push(`${name} is ${now} and metrics.json says ${metric.now}. Record ${now} in metrics.json.`)
    if (goal !== metric.goal)
      drift.push(`${name} has goal ${goal} and metrics.json says ${metric.goal}. Record goal ${goal} in metrics.json.`)
  }
  for (const [name, runner] of Object.entries(timedMetrics)) {
    const limit = recorded[name]?.limit
    if (typeof limit === "number") rows.push({ name, limit })
    else drift.push(`${name} is timed by ${runner} and has no limit in metrics.json.`)
  }
  for (const [name, metric] of Object.entries(recorded)) {
    if (name in measuring || name in timedMetrics || name in judgedBy) continue
    if ("limit" in metric) drift.push(`${name} has a limit in metrics.json and no runner times it.`)
    else drift.push(`${name} is in metrics.json and nothing measures it.`)
  }
  return { rows, drift }
}

export const metricLines = (rows) => {
  const width = Math.max(...rows.map((row) => row.name.length))
  return rows
    .filter((row) => !("limit" in row))
    .map((row) => `metric ${row.name.padEnd(width)}  now ${row.now}  goal ${row.goal}`)
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const { rows, drift } = await readMetrics(path.resolve(path.dirname(self), "..")).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  for (const line of metricLines(rows)) console.log(line)
  for (const line of drift) console.log(line)
  if (drift.length > 0) process.exit(1)
}

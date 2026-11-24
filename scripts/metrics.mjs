import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { changesFrom, unitShardVariable } from "./check-steps.mjs"
import { knowsMain } from "./checked.mjs"
import { titleLimit } from "./title.mjs"
import { readRun } from "./vitest-metrics.mjs"

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

const knownFailures = (root) => readRun(root).faults + browserFaults(root)

export const longTitles = (titles) => titles.filter((title) => [...title].length > titleLimit).length

export const mainTitles = (root) => {
  if (!knowsMain(root)) throw new Error("long-titles reads origin/main, which is missing. Run git fetch origin main.")
  return execFileSync("git", ["log", "-50", "--no-merges", "--format=%s", "origin/main", "--"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .filter((title) => title !== "")
}

export const measures = {
  "known-failures": knownFailures,
  "long-titles": (root) => longTitles(mainTitles(root)),
}

export const measuredLive = new Set(["known-failures", "long-titles"])

export const readFromUnitRun = new Set(["known-failures"])

export const unitShardOf = (env) => {
  const [current, total] =
    /^([1-9]\d*)\/([1-9]\d*)$/
      .exec(env[unitShardVariable] ?? "")
      ?.slice(1)
      .map(Number) ?? []
  return total > 1 ? { current, total } : undefined
}

const fromUnitRun = Object.fromEntries(Object.entries(measures).filter(([name]) => readFromUnitRun.has(name)))

const splitMeasures = ({ current, total }) => {
  const note = `(unit shard ${current}/${total}: this shard's part, and the whole run is the sum of the shards)`
  return {
    ...fromUnitRun,
    "known-failures": Object.assign((root) => readRun(root).faults + (current === 1 ? browserFaults(root) : 0), {
      note,
    }),
  }
}

export const measuredHere = (env) => {
  if (changesFrom(env).unitTests !== "all")
    return Object.fromEntries(Object.entries(measures).filter(([name]) => !readFromUnitRun.has(name)))
  const shard = unitShardOf(env)
  return shard === undefined ? measures : splitMeasures(shard)
}

export const timedMetrics = {
  "check-duration": "scripts/check.mjs",
  "gate-duration": "scripts/gate.mjs",
}

export const timedOnCi = {
  "ci-duration": ".github/workflows/ci.yml",
}

export const reportedMetrics = {
  "time-to-merge": "scripts/ci-failure-report.mjs",
  "time-to-notice": "scripts/ci-failure-report.mjs",
  "drag-frame": "tests/browser/editor-speed.spec.ts",
  "drag-delay": "tests/browser/editor-speed.spec.ts",
}

const judgedBy = {
  "eval-coverage": "tests/eval-coverage.test.ts",
  "design-findings": "scripts/design-findings.mjs",
}

const directions = new Set(["higher", "lower"])

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
      if (measured !== undefined) rows.push({ name, now: measured, goal: metric.goal, note: measure.note })
      continue
    }
    const { now, goal } = typeof measured === "number" ? { now: measured, goal: metric.goal } : measured
    rows.push({ name, now, goal })
    if (now !== metric.now)
      drift.push(`${name} is ${now} and metrics.json says ${metric.now}. Record ${now} in metrics.json.`)
    if (goal !== metric.goal)
      drift.push(`${name} has goal ${goal} and metrics.json says ${metric.goal}. Record goal ${goal} in metrics.json.`)
  }
  for (const [name, runner] of Object.entries({ ...timedMetrics, ...timedOnCi, ...reportedMetrics })) {
    const limit = recorded[name]?.limit
    if (typeof limit === "number") rows.push({ name, limit })
    else drift.push(`${name} is timed by ${runner} and has no limit in metrics.json.`)
  }
  for (const [name, metric] of Object.entries(recorded)) {
    if ("goal" in metric && !directions.has(metric.better))
      drift.push(`${name} has a goal and no direction. Record "better": "higher" or "lower" beside it in metrics.json.`)
    if (name in measures || name in timedMetrics || name in timedOnCi || name in reportedMetrics || name in judgedBy)
      continue
    if ("limit" in metric) drift.push(`${name} has a limit in metrics.json and no runner times it.`)
    else drift.push(`${name} is in metrics.json and nothing measures it.`)
  }
  return { rows, drift }
}

export const metricLines = (rows) => {
  const width = Math.max(...rows.map((row) => row.name.length))
  return rows
    .filter((row) => !("limit" in row))
    .map(
      (row) => `metric ${row.name.padEnd(width)}  now ${row.now}  goal ${row.goal}${row.note ? `  ${row.note}` : ""}`,
    )
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const measuring = measuredHere(process.env)
  const { rows, drift } = await readMetrics(path.resolve(path.dirname(self), ".."), measuring).catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
  for (const line of metricLines(rows)) console.log(line)
  if (changesFrom(process.env).unitTests !== "all")
    console.log(
      `${[...readFromUnitRun].join(" and ")} read the whole unit run, and this run did not run every unit test, so main's full run measures them.`,
    )
  for (const line of drift) console.log(line)
  if (drift.length > 0) process.exit(1)
}

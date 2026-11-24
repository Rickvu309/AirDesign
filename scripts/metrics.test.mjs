import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  measuredHere,
  measures,
  overLimit,
  metricLines,
  readFromUnitRun,
  readMetrics as readEvery,
  reportedMetrics,
  timeMetric,
} from "./metrics.mjs"
import { timedMetrics, timedOnCi } from "./metrics.mjs"

const fromUnitMeasures = Object.fromEntries([...readFromUnitRun].map((name) => [name, true]))
const offline = Object.fromEntries(Object.entries(measures).filter(([name]) => name !== "import-parse"))
const readMetrics = (at) => readEvery(at, offline)

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-metrics-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))

const write = (relative, source) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
}
const cache = (tests, faults) => {
  const file = path.join(root, "node_modules/.cache/vitest-metrics.json")
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ tests, faults })}\n`)
}
const record = (faults, tests = 2) => {
  cache(tests, faults)
  write(
    "metrics.json",
    JSON.stringify({
      "known-failures": { now: faults, goal: 0, better: "lower" },
      "corpus-size": { now: 1, goal: 20, better: "higher" },
      "export-coverage": { now: 2, goal: 3, better: "higher" },
      "fault-detection": { now: 1, goal: 2, better: "higher" },
      "long-titles": { goal: 0, better: "lower" },
      "check-duration": { limit: 40 },
      "gate-duration": { limit: 60 },
      "ci-duration": { limit: 40 },
      "pptx-check-duration": { limit: 90 },
      "time-to-merge": { limit: 45 },
      "time-to-notice": { limit: 15 },
      "drag-frame": { limit: 20 },
      "drag-delay": { limit: 50 },
    }),
  )
}

write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
write(
  "scripts/pptx-fixtures/cases.json",
  JSON.stringify([
    { before: "a.pptx", after: "b.pptx" },
    { before: "a.pptx", after: "a.pptx" },
  ]),
)
write("scripts/pptx-fixtures/judge-proof.json", JSON.stringify({ "one kind": "caught", "other kind": "missed" }))
const seedList = (known) => write("scripts/pptx-fixtures/judge-seeds.json", JSON.stringify({ seeds: [1], known }))
seedList([])
write("scripts/pptx-fixtures/a.pptx", "x".repeat(100_000))
write("scripts/pptx-fixtures/b.pptx", "x")
write(
  "packages/pptx/package.json",
  JSON.stringify({ name: "@airdesign/pptx", type: "module", exports: { ".": { import: "./dist/index.js" } } }),
)
write("packages/pptx/dist/index.js", 'export const writtenRoutes = { text: "txBody", move: "xfrm", resize: "xfrm" }\n')
record(1)
execFileSync("git", ["init", "-q"], { cwd: root })
execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "Start", "--author", "A <a@b.c>"], {
  cwd: root,
  env: { ...process.env, GIT_COMMITTER_NAME: "A", GIT_COMMITTER_EMAIL: "a@b.c" },
})
execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root })
execFileSync("git", ["add", "-A"], { cwd: root })

const steady = await readMetrics(root)
if (steady.drift.length !== 0) throw new Error(`a matching record drifted\n${steady.drift.join("\n")}`)
if (steady.rows.find((row) => row.name === "known-failures")?.now !== 1)
  throw new Error("one known failure was not counted")

cache(2, 2)
if (steady.rows.find((row) => row.name === "check-duration")?.limit !== 40)
  throw new Error("a limit metric was not listed")

if (timedMetrics["check-duration"] !== "scripts/check.mjs" || "ci-duration" in timedMetrics)
  throw new Error("check-duration is the local check's seconds, timed by scripts/check.mjs")
if (timedOnCi["ci-duration"] !== ".github/workflows/ci.yml" || "check-duration" in timedOnCi)
  throw new Error("ci-duration is the merge queue's minutes, timed by the ci workflow")
if (
  reportedMetrics["time-to-merge"] !== "scripts/ci-failure-report.mjs" ||
  reportedMetrics["time-to-notice"] !== "scripts/ci-failure-report.mjs"
)
  throw new Error("time-to-merge and time-to-notice are medians the failure report prints")
if (
  reportedMetrics["drag-frame"] !== "tests/browser/editor-speed.spec.ts" ||
  reportedMetrics["drag-delay"] !== "tests/browser/editor-speed.spec.ts"
)
  throw new Error("drag-frame and drag-delay are the milliseconds the drag feel check prints")
if (!fs.readFileSync(path.join(repoRoot, "scripts/check.mjs"), "utf8").includes('timeMetric(root, "check-duration"'))
  throw new Error("scripts/check.mjs must time check-duration")
if (
  timedMetrics["gate-duration"] !== "scripts/gate.mjs" ||
  !fs.readFileSync(path.join(repoRoot, "scripts/gate.mjs"), "utf8").includes('timeMetric(root, "gate-duration"')
)
  throw new Error("gate-duration is the seconds of the gate before a push, timed by scripts/gate.mjs")
if (steady.rows.find((row) => row.name === "ci-duration")?.limit !== 40)
  throw new Error("a metric timed on ci was not listed with its limit")

const capabilities = steady.rows.find((row) => row.name === "export-coverage")
if (capabilities?.now !== 2 || capabilities.goal !== 3)
  throw new Error(`distinct routes were not counted against the recorded goal: ${JSON.stringify(capabilities)}`)

const planted = steady.rows.find((row) => row.name === "fault-detection")
if (planted?.now !== 1 || planted.goal !== 2)
  throw new Error(`caught kinds were not counted: ${JSON.stringify(planted)}`)

const slow = overLimit({ name: "check-duration", now: 41.2, limit: 40 })
if (slow !== "check-duration is 41.2 and its limit is 40. Make it faster.") throw new Error(`${slow}`)
if (overLimit({ name: "check-duration", now: 40, limit: 40 }) !== undefined)
  throw new Error("a time at the limit was reported")
const timed = timeMetric(root, "check-duration", Date.now() - 41_200)
if (!/^metric check-duration  now 41\.\d  limit 40$/.test(timed.line)) throw new Error(timed.line)
if (!timed.over?.startsWith("check-duration is 41.")) throw new Error(`${timed.over}`)
if (timeMetric(root, "check-duration", Date.now()).over !== undefined) throw new Error("a fast run was reported")
const ciBefore = process.env.CI
for (const value of ["true", "1", "", "false"]) {
  process.env.CI = value
  const late = timeMetric(root, "check-duration", Date.now() - 81_200)
  if (late.fails !== undefined) throw new Error(`a time over its limit must only warn, with CI=${value}`)
  if (!late.over?.startsWith("check-duration is 81.")) throw new Error(`a late run was not reported: ${late.over}`)
}
if (ciBefore === undefined) delete process.env.CI
else process.env.CI = ciBefore
let unlimited = ""
try {
  timeMetric(root, "nobody limits", Date.now())
} catch (error) {
  unlimited = error.message
}
if (unlimited !== "nobody limits has no limit in metrics.json.") throw new Error(`a missing limit passed: ${unlimited}`)

const added = (await readMetrics(root)).drift
if (added.length !== 0) {
  throw new Error(`a new known failure must need no record\n${added.join("\n")}`)
}

cache(2, 0)
write("packages/a/src/a.test.ts", 'it("one", () => {})\nit("two", () => {})\n')
const fixed = (await readMetrics(root)).drift
if (fixed.length !== 0) {
  throw new Error(`a fixed fault must need no record\n${fixed.join("\n")}`)
}

write("packages/a/src/a.spec.js", "expect(result.failed).toBe(1)\nexpect.soft(failure).toBeDefined()\n")
execFileSync("git", ["add", "-A"], { cwd: root })
if ((await readMetrics(root)).rows.find((row) => row.name === "known-failures")?.now !== 0)
  throw new Error("a passing test was counted as a known failure")
seedList([{ seed: 1, kind: "one kind", deck: "a.pptx", what: "slide 1" }])
if ((await readMetrics(root)).rows.find((row) => row.name === "known-failures")?.now !== 1)
  throw new Error("a listed miss must show in the known-failures metric")
seedList([])
if ((await readMetrics(root)).rows.find((row) => row.name === "known-failures")?.now !== 0)
  throw new Error("an empty seed list must add no known failure")
write(
  "tests/journeys/a.spec.ts",
  'test("bug", async () => {\n  test.fail()\n  expect(/x/.test("x")).toBe(true)\n})\ntest("ok", async () => {})\n',
)
if ((await readMetrics(root)).rows.find((row) => row.name === "known-failures")?.now !== 1)
  throw new Error("a Playwright test.fail must count as one known failure")
fs.rmSync(path.join(root, "tests"), { recursive: true })
fs.rmSync(path.join(root, "scripts/pptx-fixtures/judge-seeds.json"))
if ((await readMetrics(root)).rows.find((row) => row.name === "known-failures")?.now !== 0)
  throw new Error("a repo with no seed list has no listed miss")
seedList([])

write(
  "metrics.json",
  JSON.stringify({
    "known-failures": { now: 0, goal: 0 },
    "export-coverage": { now: 1, goal: 4 },
    "fault-detection": { now: 1, goal: 3 },
    "nobody measures": { now: 1, goal: 0 },
    "nobody times": { limit: 5 },
    "no direction": { now: 1, goal: 2 },
    "odd direction": { now: 1, goal: 2, better: "up" },
  }),
)
const loose = (await readMetrics(root)).drift.join("\n")
if (!loose.includes("export-coverage is 2 and metrics.json says 1. Record 2 in metrics.json.")) throw new Error(loose)
if (loose.includes("export-coverage has goal")) throw new Error(loose)
if (!loose.includes("fault-detection has goal 2 and metrics.json says 3. Record goal 2 in metrics.json."))
  throw new Error(loose)
if (!loose.includes("nobody times has a limit in metrics.json and no runner times it.")) throw new Error(loose)
if (!loose.includes("check-duration is timed by scripts/check.mjs and has no limit in metrics.json."))
  throw new Error(loose)
if (!loose.includes("ci-duration is timed by .github/workflows/ci.yml and has no limit in metrics.json."))
  throw new Error(loose)
if (!loose.includes("nobody measures is in metrics.json and nothing measures it.")) throw new Error(loose)
const needsDirection = (name) =>
  `${name} has a goal and no direction. Record "better": "higher" or "lower" beside it in metrics.json.`
if (!loose.includes(needsDirection("no direction"))) throw new Error(loose)
if (!loose.includes(needsDirection("odd direction"))) throw new Error(loose)
if (!loose.includes(needsDirection("known-failures"))) throw new Error(loose)
if (!loose.includes("corpus-size is measured and missing from metrics.json.")) throw new Error(loose)

const proveVitest = () => {
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-vitest-metrics-"))
  const reported = path.join(probe, "result.json")
  try {
    fs.writeFileSync(
      path.join(probe, "sample.test.ts"),
      [
        'import fc from "fast-check"',
        'import { describe, expect, it, test } from "vitest"',
        'it("plain", () => { expect(1).toBe(1) })',
        'it("property", () => { fc.assert(fc.property(fc.integer(), (value) => value === value)) })',
        'it("none", () => {})',
        'it("early", () => { return })',
        'it.skip("skipped", () => {})',
        'it.skipIf(true)("skip if", () => {})',
        'it.runIf(false)("run if", () => {})',
        'it.fails("expected", () => { expect(1).toBe(2) })',
        'it("option", { fails: true }, () => { expect(1).toBe(2) })',
        'test.todo("todo")',
        'it["skip"]("bracket", () => {})',
        'describe.skip("block", () => { it("inside", () => {}) })',
        'it("reads skip", () => { expect({ skip: true }.skip).toBe(true) })',
        'it("ctx", (ctx) => { ctx.skip() })',
        "",
      ].join("\n"),
    )
    fs.writeFileSync(
      path.join(probe, "vitest.config.mts"),
      [
        'import { defineConfig } from "vitest/config"',
        "export default defineConfig({",
        "  resolve: {",
        "    alias: [{",
        "      find: /^fast-check$/,",
        `      replacement: ${JSON.stringify(path.join(repoRoot, "scripts/property-count.mjs"))},`,
        "    }],",
        "  },",
        "  test: {",
        '    include: ["sample.test.ts"],',
        `    setupFiles: [${JSON.stringify(path.join(repoRoot, "scripts/vitest-assertions.mjs"))}],`,
        `    reporters: ["default", ${JSON.stringify(path.join(repoRoot, "scripts/vitest-metrics.mjs"))}],`,
        "  },",
        "})",
        "",
      ].join("\n"),
    )
    fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(probe, "node_modules"), "dir")
    try {
      execFileSync(process.execPath, [path.join(repoRoot, "node_modules/vitest/vitest.mjs"), "run"], {
        cwd: probe,
        env: { ...process.env, AIRDESIGN_VITEST_METRICS: reported },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      const failed = error
      throw new Error(`${failed.stdout ?? ""}\n${failed.stderr ?? failed.message}`)
    }
    const counted = JSON.parse(fs.readFileSync(reported, "utf8"))
    if (counted.tests !== 14 || counted.faults !== 11) {
      throw new Error(`vitest counted ${JSON.stringify(counted)}, expected 14 tests and 11 faults`)
    }
  } finally {
    fs.rmSync(path.join(probe, "node_modules"), { force: true })
    fs.rmSync(probe, { recursive: true, force: true })
  }
}

proveVitest()

record(1, 2)
cache(3, 1)
const more = await readMetrics(root)
if (more.drift.length !== 0) throw new Error(`a new test must need no record\n${more.drift.join("\n")}`)
const moreLines = metricLines(more.rows).map((line) => line.replace(/ {2,}/g, "  "))
if (moreLines.some((line) => line.includes("duration"))) throw new Error("a limit metric was printed as a count")

cache(2, 5)
const faulty = await readMetrics(root)
if (faulty.drift.length !== 0) throw new Error(`four new known failures must not fail\n${faulty.drift.join("\n")}`)
const faultyLines = metricLines(faulty.rows).map((line) => line.replace(/ {2,}/g, "  "))
if (!faultyLines.includes("metric known-failures  now 5  goal 0")) throw new Error(faultyLines.join("\n"))

cache(1, 1)
const fewerTests = await readMetrics(root)
if (fewerTests.drift.length !== 0) throw new Error(`a removed test must not fail\n${fewerTests.drift.join("\n")}`)
if (fewerTests.rows.some((row) => row.name === "test-count")) throw new Error("the test count is still a metric")

record(1, 2)
const deckCount = (metrics) => metrics.rows.find((row) => row.name === "corpus-size")?.now
const withoutList = await readMetrics(root)
if (deckCount(withoutList) !== 1) throw new Error(`no corpus list must count the case decks: ${deckCount(withoutList)}`)
write(
  "scripts/pptx-fixtures/corpus.json",
  JSON.stringify([
    { name: "x.pptx", sha256: "0", source: "https://example.gov/x.pptx" },
    { name: "y.pptx", sha256: "0", source: "https://example.gov/y.pptx" },
  ]),
)
const withList = await readMetrics(root)
if (deckCount(withList) !== 3) throw new Error(`the corpus list was not counted: ${deckCount(withList)}`)
if (!withList.drift.includes("corpus-size is 3 and metrics.json says 1. Record 3 in metrics.json.")) {
  throw new Error(`a longer corpus list must ask for a record\n${withList.drift.join("\n")}`)
}
fs.rmSync(path.join(root, "scripts/pptx-fixtures/corpus.json"))

if (measuredHere({}) !== measures || measuredHere({ AIRDESIGN_UNIT_TESTS: "all" }) !== measures)
  throw new Error("a run of every unit test must measure every metric")
const narrowed = Object.fromEntries(
  Object.entries(measuredHere({ AIRDESIGN_UNIT_TESTS: '["packages/oauth/"]' })).filter(([name]) => name in offline),
)
fs.rmSync(path.join(root, "node_modules/.cache/vitest-metrics.json"))
const fromNarrowRun = await readEvery(root, narrowed)
const names = fromNarrowRun.rows.map((row) => row.name)
if (names.includes("known-failures"))
  throw new Error("a run of only the unit tests its change reaches must not read the whole unit run")
if (fromNarrowRun.drift.some((line) => /known-failures/.test(line)))
  throw new Error(`a narrowed run must not call the unit run's metrics unmeasured\n${fromNarrowRun.drift.join("\n")}`)

const unitShard = (current) => ({ AIRDESIGN_UNIT_TESTS: "all", AIRDESIGN_UNIT_SHARD: `${current}/3` })
const inShard = (current) =>
  Object.fromEntries(Object.entries(measuredHere(unitShard(current))).filter(([name]) => name in offline))
const unitRow = (read, name) => read.rows.find((row) => row.name === name)

seedList([{ seed: 1, kind: "one kind", deck: "a.pptx", what: "slide 1" }])
cache(2, 1)
const secondShard = await readEvery(root, inShard(2))
const measuredRows = (read) => read.rows.filter((row) => !("limit" in row))
if (
  measuredRows(secondShard)
    .map((row) => row.name)
    .join() !== "known-failures"
)
  throw new Error(
    `a later shard reads only the unit run's metrics: ${measuredRows(secondShard).map((row) => row.name)}`,
  )
if (unitRow(secondShard, "known-failures")?.now !== 1)
  throw new Error("a later shard counts its own faults and none of the repo's static ones")
if (!unitRow(secondShard, "known-failures")?.note?.includes("unit shard 2/3"))
  throw new Error("a shard's known-failures line says it is one part of the sum")
if (metricLines(secondShard.rows).length !== 1 || !metricLines(secondShard.rows)[0].includes("unit shard 2/3"))
  throw new Error("a shard prints the note beside its number")
cache(2, 2)
const firstShard = await readEvery(root, inShard(1))
if (measuredRows(firstShard).some((row) => !(row.name in fromUnitMeasures)))
  throw new Error("a shard measures only the unit run's metrics, since another source job measures the rest")
if (unitRow(firstShard, "known-failures")?.now !== 2 + 1)
  throw new Error(
    `the first shard adds the repo's static faults to its own: ${unitRow(firstShard, "known-failures")?.now}`,
  )
if (measuredHere({ ...unitShard(1), AIRDESIGN_UNIT_SHARD: "1/1" }) !== measures)
  throw new Error("one shard is the whole run")
if (
  Object.keys(measuredHere({ AIRDESIGN_UNIT_TESTS: '["packages/oauth/"]', AIRDESIGN_UNIT_SHARD: "2/3" })).some(
    (name) => name in fromUnitMeasures,
  )
)
  throw new Error("a narrowed run measures nothing from the unit run, shards or not")

console.log("metrics tests passed")

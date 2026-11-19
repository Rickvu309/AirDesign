import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "yaml"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
const upload = workflow.jobs.check.steps.find((step) => step.with?.path === "test-results/browser-timings.json")
assert.ok(upload, "successful browser timings must be downloadable")
assert.equal(
  upload.if,
  "!cancelled() && steps.work.outputs.needed == 'true' && (matrix.part == 'browser' || matrix.part == 'design')",
)
assert.equal(upload.with.name, "browser-timings-${{ matrix.part }}-${{ strategy.job-index }}")
assert.equal(upload["continue-on-error"], true)
assert.equal(upload["timeout-minutes"], 2)
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "browser-timings-"))
try {
  fs.symlinkSync(path.join(root, "node_modules"), path.join(folder, "node_modules"), "dir")
  fs.symlinkSync(path.join(root, "scripts"), path.join(folder, "scripts"), "dir")
  fs.writeFileSync(
    path.join(folder, "playwright.config.ts"),
    `
import config from ${JSON.stringify(path.join(root, "playwright.config.ts"))}
export default { ...config, testDir: '.', globalSetup: undefined, webServer: undefined, workers: 1 }
`,
  )
  fs.writeFileSync(
    path.join(folder, "a.spec.ts"),
    `
import { test } from '@playwright/test'
test('passes', async () => {
  test.info().annotations.push({ type: 'gesture', description: 'move' })
  test.info().annotations.push({ type: 'metric', description: 'metric demo-time  now 3  limit 2' })
  test.info().annotations.push({ type: 'warning', description: 'demo-time is 3 and its limit is 2. Make it faster.' })
})
test('also passes', async () => {})
test('still passes', async () => {})
test.skip('skips', async () => {})
`,
  )
  fs.writeFileSync(
    path.join(folder, "b.spec.ts"),
    `
import { test } from '@playwright/test'
test('fails', async () => { throw new Error('deliberate failure') })
test('expected failure', async () => { test.fail(); throw new Error('known failure') })
`,
  )
  const reports = []
  for (const current of [1, 2]) {
    const summary = path.join(folder, `summary-${current}.md`)
    const run = spawnSync(
      process.execPath,
      [path.join(root, "node_modules/@playwright/test/cli.js"), "test", `--shard=${current}/2`],
      {
        cwd: folder,
        encoding: "utf8",
        env: { ...process.env, GITHUB_STEP_SUMMARY: summary, GITHUB_ACTIONS: "true" },
      },
    )
    assert.equal(run.status, current === 1 ? 0 : 1, run.stdout + run.stderr)
    const report = JSON.parse(fs.readFileSync(path.join(folder, "test-results/browser-timings.json"), "utf8"))
    assert.deepEqual(report.shard, { current, total: 2 })
    assert.equal(report.workers, 1)
    assert.equal(report.scheduled, current === 1 ? 4 : 2)
    assert.equal(report.status, current === 1 ? "passed" : "failed")
    assert.ok(report.duration >= 0)
    assert.ok(fs.readFileSync(summary, "utf8").includes(JSON.stringify(report)))
    if (current === 1) {
      assert.match(run.stdout, /^metric demo-time {2}now 3 {2}limit 2$/m, "a test's metric line reaches the log")
      assert.match(run.stdout, /^::warning::demo-time is 3 and its limit is 2\. Make it faster\.$/m)
      assert.ok(fs.readFileSync(summary, "utf8").includes("metric demo-time  now 3  limit 2"))
      const measured = report.tests.find((test) => test.title.at(-1) === "passes")
      assert.deepEqual(measured?.notes, [
        { type: "metric", description: "metric demo-time  now 3  limit 2" },
        { type: "warning", description: "demo-time is 3 and its limit is 2. Make it faster." },
      ])
      assert.ok(report.tests.filter((test) => test !== measured).every((test) => !("notes" in test)))
    }
    reports.push(report)
  }
  const tests = reports.flatMap((report) => report.tests)
  assert.deepEqual(tests.map((test) => test.status).sort(), [
    "failed",
    "failed",
    "passed",
    "passed",
    "passed",
    "skipped",
  ])
  assert.equal(new Set(tests.map((test) => test.id)).size, 6)
  assert.equal(tests.filter((test) => test.status !== test.expectedStatus).length, 1)
  for (const test of tests) {
    assert.ok(test.file.endsWith(".spec.ts"))
    assert.ok(test.duration >= 0)
    assert.equal(test.retry, 0)
    assert.ok(test.title.length > 0)
  }
  console.log("browser-timings: passing, failing and skipped tests retain timings and metrics across shards")
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

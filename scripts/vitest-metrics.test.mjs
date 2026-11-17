import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import VitestMetrics from "./vitest-metrics.mjs"

const root = path.resolve(import.meta.dirname, "..")
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "affected-results-"))
try {
  fs.symlinkSync(path.join(root, "node_modules"), path.join(folder, "node_modules"), "dir")
  fs.writeFileSync(
    path.join(folder, "vitest.config.mjs"),
    `export default { test: { reporters: [${JSON.stringify(path.join(root, "scripts/vitest-metrics.mjs"))}] } }`,
  )
  fs.writeFileSync(
    path.join(folder, "a.test.ts"),
    "import {test, expect} from 'vitest'; test('broken', () => expect(1).toBe(2))",
  )
  const run = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/vitest/vitest.mjs"), "run", "--maxWorkers=1"],
    {
      cwd: folder,
      encoding: "utf8",
      env: { ...process.env, AIRDESIGN_VITEST_METRICS: path.join(folder, "metrics.json") },
    },
  )
  assert.equal(run.status, 1, run.stdout + run.stderr)
  const report = JSON.parse(fs.readFileSync(path.join(folder, "test-results/affected-unit-results.json"), "utf8"))
  assert.equal(report.complete, true)
  assert.equal(report.tests[0].file, "a.test.ts")
  assert.equal(report.tests[0].status, "failed")
  assert.deepEqual(report.tests[0].failures, ["broken"])
  assert.ok(report.tests[0].duration >= 0)
  const reporter = new VitestMetrics()
  reporter.onInit({ config: { root: folder } })
  fs.rmSync(path.join(folder, "test-results"), { recursive: true })
  fs.writeFileSync(path.join(folder, "test-results"), "blocked")
  const previous = process.env.AIRDESIGN_VITEST_METRICS
  process.env.AIRDESIGN_VITEST_METRICS = path.join(folder, "metrics.json")
  try {
    reporter.onTestRunEnd([], [], "passed")
  } finally {
    if (previous === undefined) delete process.env.AIRDESIGN_VITEST_METRICS
    else process.env.AIRDESIGN_VITEST_METRICS = previous
  }
  console.log("vitest-metrics: actual failed file retained; report write failure stays advisory")
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

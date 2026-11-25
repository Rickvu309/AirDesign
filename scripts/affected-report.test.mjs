import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import { registerHooks } from "node:module"
import os from "node:os"
import path from "node:path"
import { parse } from "yaml"
import { affectedReport } from "./affected-report.mjs"
import { checkSteps } from "./check-steps.mjs"
import { packagesFor, testsFor } from "./gate.mjs"
import { proofPlan } from "../.agents/skills/verify-airdesign/bin/prove-plan.mjs"

assert.deepEqual(Object.keys(await import("./affected-report.mjs")), ["affectedReport"])

const root = path.resolve(import.meta.dirname, "..")
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "affected-report-"))
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true })
  fs.writeFileSync(path.join(folder, file), text)
}
const git = (...args) => execFileSync("git", args, { cwd: folder, encoding: "utf8" }).trim()
try {
  fs.symlinkSync(path.join(root, "node_modules"), path.join(folder, "node_modules"), "dir")
  write(".gitignore", "node_modules\n")
  write("package.json", '{"type":"module"}')
  write("vitest.config.mjs", `export default { test: { include: ['packages/a/src/*.test.ts'] } }`)
  write("packages/a/src/core.ts", "export const value = 1")
  write(
    "packages/a/src/a.test.ts",
    "import { value } from './core'; import {test, expect} from 'vitest'; test('a', () => expect(value).toBe(1))",
  )
  write("packages/a/src/b.test.ts", "import {test} from 'vitest'; test('b', () => {})")
  write("scripts/spec-replays.mjs", "export const replays = () => []")
  write("scripts/test-reads.mjs", fs.readFileSync(path.join(root, "scripts/test-reads.mjs"), "utf8"))
  write("scripts/a.mjs", "export const a = 1")
  write("scripts/a.test.mjs", 'import { a } from "./a.mjs"')
  write("tests/browser/a.spec.ts", 'import { a } from "./a"')
  write("tests/browser/a.ts", "export const a = 1")
  write("apps/web/package.json", "{}")
  write("apps/api/package.json", "{}")
  write("apps/web/src/editor/screen.ts", 'export const screen = "/screens/s1-test"')
  write(".github/workflows/ci.yml", "jobs: {}")
  git("init", "-q")
  git("add", ".")
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Create fixture")
  const base = git("rev-parse", "HEAD")
  const reportFor = async (file, text = "export const changed = 2") => {
    write(file, text)
    git("add", "-A")
    git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Change fixture")
    return affectedReport({ root: folder, base: "HEAD^", head: "HEAD" })
  }
  const sourceOnly = registerHooks({
    load(url, context, next) {
      assert.doesNotMatch(url, /\/packages\/[^/]+\/dist\//, "planning must work before workspace packages build")
      return next(url, context)
    },
  })
  const reached = await reportFor("packages/a/src/core.ts").finally(() => sourceOnly.deregister())
  assert.deepEqual(reached.incomplete, [])
  assert.deepEqual(reached.unit.files, ["packages/a/src/a.test.ts"])
  assert.deepEqual(reached.unit.leftOut, [])
  for (const file of [
    "apps/api/src/migration.sql",
    "packages/a/src/fixture.json",
    "scripts/vitest-api-database.mjs",
    "scripts/unknown.mjs",
  ]) {
    const report = await reportFor(file)
    assert.equal(report.unit.reached, "all", file)
  }
  const browser = await reportFor("tests/browser/a.ts")
  assert.deepEqual(browser.browser.files, ["tests/browser/a.spec.ts"])
  const added = await reportFor("packages/a/src/new.test.ts", "import {test} from 'vitest'; test('new', () => {})")
  assert.ok(added.unit.files.includes("packages/a/src/new.test.ts"))
  const gap = await reportFor("packages/a/src/unsupported.test.tsx", "export const a = 1")
  assert.equal(gap.unit.reached, "all", "an undiscovered test never means nothing affected")
  git("mv", "packages/a/src/core.ts", "packages/a/src/renamed.ts")
  const renamed = await reportFor(
    "packages/a/src/a.test.ts",
    "import './renamed'; import {test} from 'vitest'; test('a', () => {})",
  )
  assert.equal(renamed.unit.reached, "all", "base-side rename edge cannot disappear")
  git("rm", "packages/a/src/renamed.ts")
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Delete source")
  assert.equal((await affectedReport({ root: folder, base: "HEAD^", head: "HEAD" })).unit.reached, "all")
  const changed = ["scripts/a.mjs"]
  const plan = proofPlan({ changed, scripts: { "scripts/a.mjs": [], "scripts/a.test.mjs": ["scripts/a.mjs"] } })
  const related = []
  const chosen = () =>
    checkSteps.affectedGateStages({
      tests: testsFor({ map: { unitTests: [] }, related, inventory: [], changed }).files,
      tooling: plan.steps.find((s) => s.kind === "script-tests").files,
      packages: packagesFor(changed),
    })
  const before = chosen()
  const local = await affectedReport({
    root: folder,
    base,
    head: "HEAD",
    gate: { plan, related, tests: [], tooling: ["scripts/a.test.mjs"] },
  })
  assert.deepEqual(chosen(), before, "reporting cannot change gate steps")
  assert.equal(local.browser.reached, "all")
  assert.match(local.browser.reason, /ci/)
  write(
    "test-results/affected-unit-results.json",
    JSON.stringify({
      complete: true,
      tests: [
        { file: "packages/a/src/a.test.ts", status: "failed", duration: 20 },
        { file: "outside.test.ts", status: "failed", duration: 5 },
      ],
    }),
  )
  const failures = await affectedReport({
    root: folder,
    base: "HEAD",
    gate: {
      plan: proofPlan({ changed: ["packages/a/src/a.test.ts"] }),
      related: ["packages/a/src/a.test.ts"],
      tests: ["packages/a/src/a.test.ts"],
      tooling: [],
    },
    part: "source",
  })
  assert.deepEqual(
    failures.failures.map((test) => test.insideReached),
    [true, false],
  )
  assert.equal(failures.unit.seconds.reached.seconds, 0.02)
  write(
    "test-results/browser-timings.json",
    JSON.stringify({
      status: "failed",
      scheduled: 2,
      tests: [
        { file: "a.spec.ts", status: "failed", expectedStatus: "passed", duration: 25 },
        { file: "a.spec.ts", status: "failed", expectedStatus: "failed", duration: 30 },
      ],
    }),
  )
  const browserFailure = await affectedReport({ root: folder, base: "HEAD", head: "HEAD", part: "browser" })
  const timedBrowser = await affectedReport({ root: folder, base: "HEAD^", head: "HEAD", part: "browser" })
  assert.equal(timedBrowser.browser.seconds.leftOut.recorded, 1)
  assert.equal(timedBrowser.browser.seconds.leftOut.seconds, 0.055)
  assert.equal(browserFailure.failures.length, 1, "expected failures are not regressions")
  assert.equal(browserFailure.failures[0].insideReached, false)
  write("test-results/browser-timings.json", JSON.stringify({ status: "failed", scheduled: 0, tests: [] }))
  const browserCrash = await affectedReport({ root: folder, base: "HEAD", head: "HEAD", part: "browser" })
  assert.equal(browserCrash.complete, false, "a failed browser run without test results is incomplete")
  const wrongHead = await affectedReport({ root: folder, base: "HEAD", head: base })
  assert.equal(wrongHead.complete, false)
  assert.equal(wrongHead.unit.reached, "all")
  assert.equal(wrongHead.unit.files, null)
  const missing = await affectedReport({ root: folder, base: "absent", head: "HEAD", part: "source" })
  assert.equal(missing.complete, false)
  assert.equal(missing.unit.reached, "all")
  assert.equal(missing.unit.files, null)
  const cli = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts/affected-report.mjs"),
      "--base",
      "absent",
      "--part",
      "source",
      "--output",
      path.join(folder, "report.json"),
    ],
    { cwd: folder, encoding: "utf8" },
  )
  assert.equal(cli.status, 0, cli.stderr)
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder, "report.json"))).complete, false)
  const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"))
  const step = workflow.jobs.check.steps.find((step) => step.uses === "./.github/actions/affected-report")
  assert.equal(step["continue-on-error"], true)
  assert.match(step.if, /always\(\)/)
  const action = parse(fs.readFileSync(path.join(root, ".github/actions/affected-report/action.yml"), "utf8"))
  for (const step of action.runs.steps) {
    assert.equal(step["continue-on-error"], true)
    assert.ok(!("timeout-minutes" in step), "GitHub rejects timeout-minutes on composite action steps")
  }
  assert.match(action.runs.steps[0].run, /timeout --kill-after=5s 2m node scripts\/affected-report\.mjs\b/)
  const upload = action.runs.steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"))
  assert.equal(upload.with["retention-days"], 7)
  assert.equal(upload.with.path, "test-results/affected-report.json")
  assert.ok(fs.statSync(path.join(root, ".github/workflows/ci.yml")).size <= 20000)
  console.log("affected-report: planted reach, unchanged gate and advisory ci passed")
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

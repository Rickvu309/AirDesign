import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runSelectedUnitTests } from "./selected-unit-tests.mjs"

const from = process.cwd()
const root = fs.mkdtempSync(path.join(os.tmpdir(), "selected-unit-tests-"))
try {
  fs.symlinkSync(path.resolve(import.meta.dirname, "../node_modules"), path.join(root, "node_modules"), "dir")
  fs.writeFileSync(
    path.join(root, "vitest.config.mjs"),
    'export default { test: { reporters: ["json"], outputFile: "report.json" } }',
  )
  for (const [folder, test] of [
    ["tests", 'import { expect, test } from "vitest"; test("selected", () => expect(1).toBe(1))'],
    ["nested/tests", 'import { test } from "vitest"; test("unselected", () => { throw new Error("unexpected") })'],
  ]) {
    fs.mkdirSync(path.join(root, folder), { recursive: true })
    fs.writeFileSync(path.join(root, folder, "picked.test.ts"), test)
  }
  process.chdir(root)
  await runSelectedUnitTests(["tests/picked.test.ts"], 2)
  const report = JSON.parse(fs.readFileSync("report.json", "utf8"))
  assert.deepEqual(
    report.testResults.map((test) => path.relative(root, test.name)),
    ["tests/picked.test.ts"],
  )
  assert.equal(report.numPassedTests, 1)
  await assert.rejects(runSelectedUnitTests(["tests/missing.test.ts"], 2), /cannot find.*tests\/missing\.test\.ts/)
} finally {
  process.chdir(from)
  fs.rmSync(root, { recursive: true, force: true })
}

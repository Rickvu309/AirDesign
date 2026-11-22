import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { specTimeoutFaults } from "./spec-timeouts.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const withTempRepo = (files, run) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-spec-timeouts-"))
  try {
    for (const [relative, content] of Object.entries(files)) {
      const full = path.join(root, relative)
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, content)
    }
    run(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

withTempRepo(
  {
    "apps/web/src/direct.test.ts": [
      'import { dumpSpec } from "../../../scripts/check-specs.mjs"',
      'import { it } from "vitest"',
      'it("runs cold", () => {',
      '  dumpSpec("a", "java", "jar", "A.tla", "A.cfg")',
      "})",
    ].join("\n"),
    "apps/web/src/aliased.test.ts": [
      'import { dumpSpec as runDump } from "../../../scripts/check-specs.mjs"',
      'import { beforeAll } from "vitest"',
      "beforeAll(() => {",
      '  runDump("a", "java", "jar", "A.tla", "A.cfg")',
      "})",
    ].join("\n"),
    "apps/web/src/local-helper.test.ts": [
      'import { it } from "vitest"',
      "async function specGraph() {",
      '  const specs = (await import("../../../scripts/check-specs.mjs")) as { dumpSpec: () => string }',
      "  return specs.dumpSpec()",
      "}",
      'it("replays under default timeout", async () => {',
      "  await specGraph()",
      "})",
    ].join("\n"),
    "apps/web/src/small-timeout.test.ts": [
      'import { beforeAll, it } from "vitest"',
      "async function specGraph() {",
      '  const specs = (await import("../../../scripts/check-specs.mjs")) as { dumpSpec: () => string }',
      "  return specs.dumpSpec()",
      "}",
      "beforeAll(async () => {",
      "  await specGraph()",
      "}, 10_000)",
      'it("sets only default 5 s", async () => {',
      "  await specGraph()",
      "}, 5_000)",
    ].join("\n"),
    "apps/web/src/top-level.test.ts": [
      'import { dumpSpec } from "../../../scripts/check-specs.mjs"',
      'dumpSpec("a", "java", "jar", "A.tla", "A.cfg")',
    ].join("\n"),
  },
  (root) => {
    const faults = specTimeoutFaults(root)
    assert.equal(faults.length, 6, faults.join("\n"))
    assert.match(faults[0], /^apps\/web\/src\/aliased\.test\.ts:3: beforeAll reaches dumpSpec \(dumpSpec\)/)
    assert.match(faults[1], /^apps\/web\/src\/direct\.test\.ts:3: it reaches dumpSpec \(dumpSpec\)/)
    assert.match(faults[2], /^apps\/web\/src\/local-helper\.test\.ts:6: it reaches dumpSpec \(specGraph -> dumpSpec\)/)
    assert.match(
      faults[3],
      /^apps\/web\/src\/small-timeout\.test\.ts:6: beforeAll reaches dumpSpec \(specGraph -> dumpSpec\)/,
    )
    assert.match(faults[4], /^apps\/web\/src\/small-timeout\.test\.ts:9: it reaches dumpSpec \(specGraph -> dumpSpec\)/)
    assert.match(faults[5], /^apps\/web\/src\/top-level\.test\.ts:1: top-level code reaches dumpSpec \(dumpSpec\)/)
  },
)

withTempRepo(
  {
    "apps/api/src/spec-graph.ts": [
      'const specifier = "scripts/check-specs.mjs"',
      "export function specGraph() {",
      "  return `import { dumpSpec } from ${specifier}`",
      "}",
      "export function walks() { return [] }",
    ].join("\n"),
    "apps/api/src/shared.ts": [
      'import { describe, it } from "vitest"',
      'import { specGraph } from "./spec-graph.js"',
      "export async function loadWalks() { return specGraph() }",
      "export function timedReplay() {",
      '  describe("timed", () => {',
      '    it("works", async () => { await loadWalks() }, 60_000)',
      "  })",
      "}",
      "export function untimedReplay() {",
      '  describe("untimed", () => {',
      '    it("misses timeout", async () => { await loadWalks() })',
      "  })",
      "}",
    ].join("\n"),
    "apps/api/src/walks-only.test.ts": [
      'import { it } from "vitest"',
      'import { walks } from "./spec-graph.js"',
      'it("uses only pure graph helpers", () => { walks() })',
    ].join("\n"),
    "apps/api/src/timed-share.test.ts": ['import { timedReplay } from "./shared.js"', "timedReplay()"].join("\n"),
    "apps/api/src/options-timeout.test.ts": [
      'import { beforeAll, it } from "vitest"',
      'import { loadWalks } from "./shared.js"',
      "beforeAll(async () => { await loadWalks() }, 60_000)",
      'it("options second", { timeout: 60_000 }, async () => { await loadWalks() })',
      'it("options third", async () => { await loadWalks() }, { timeout: 60_000 })',
      'it("computed timeout", async () => { await loadWalks() }, 60 * 1000)',
    ].join("\n"),
    "apps/api/src/untimed-caller.test.ts": [
      'import { it } from "vitest"',
      'import { loadWalks } from "./shared.js"',
      'it("forgets timeout", async () => { await loadWalks() })',
    ].join("\n"),
  },
  (root) => {
    const faults = specTimeoutFaults(root)
    assert.equal(faults.length, 2, faults.join("\n"))
    assert.match(
      faults[0],
      /^apps\/api\/src\/shared\.ts:11: it reaches dumpSpec \(loadWalks -> specGraph -> dumpSpec\)/,
    )
    assert.match(
      faults[1],
      /^apps\/api\/src\/untimed-caller\.test\.ts:3: it reaches dumpSpec \(loadWalks -> specGraph -> dumpSpec\)/,
    )
  },
)

assert.deepEqual(specTimeoutFaults(repoRoot), [], "every test in the repo that reaches dumpSpec sets its own timeout")
console.log("spec-timeouts tests passed")

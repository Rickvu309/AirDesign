import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { browserModuleSystemFaults } from "./browser-module-systems.mjs"

const root = mkdtempSync(path.join(os.tmpdir(), "browser-module-systems-"))
spawnSync("git", ["init", "-q", root])
const write = (file, source) => {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, source)
}
const faults = () =>
  browserModuleSystemFaults(root).map(({ file, line, chain }) => `${file}:${line} ${chain.join(" -> ")}`)
try {
  write("tests/browser/deck-test.ts", 'export { test } from "@playwright/test"')
  write("scripts/package-build.mjs", "export const packageBuild = () => 1")
  write("apps/web/src/copy/plain-copy.ts", 'export const plainCopy = { title: "Plain" }')
  write("apps/web/src/copy/limit-copy.ts", 'import { limits } from "@airdesign/doom"\nexport const limitCopy = limits')
  write(
    "apps/web/src/copy/typed-copy.ts",
    'import type * as doom from "@airdesign/doom"\nexport const typed: doom.Kind[] = []',
  )
  write("apps/web/src/copy/via-copy.ts", 'export { limitCopy } from "./limit-copy"')
  write("packages/doom/src/index.ts", "export const limits = {}")
  write(
    "tests/browser/clean.spec.ts",
    [
      'import { test } from "./deck-test"',
      'import { plainCopy } from "../../apps/web/src/copy/plain-copy"',
      'import { typed } from "../../apps/web/src/copy/typed-copy"',
      'import type { Build } from "../../scripts/package-build.mjs"',
      'import * as doom from "../../packages/doom/src/index.ts"',
      'test("loads lazily", async () => (await import("../../scripts/package-build.mjs")).packageBuild())',
      "export const all = [plainCopy, typed, doom]",
    ].join("\n"),
  )
  write(
    "scripts/doom-bench.test.mjs",
    'import { limits } from "../packages/doom/src/index.ts"\nexport const kept = limits',
  )
  assert.deepEqual(faults(), [])

  write(
    "tests/browser/layout-agreement.spec.ts",
    'import { test } from "./deck-test"\nimport { packageBuild } from "../../scripts/package-build.mjs"',
  )
  assert.deepEqual(faults(), ["tests/browser/layout-agreement.spec.ts:2 scripts/package-build.mjs (an ES module)"])
  rmSync(path.join(root, "tests/browser/layout-agreement.spec.ts"))

  write("tests/browser/picture.spec.ts", 'import { limitCopy } from "../../apps/web/src/copy/via-copy"')
  assert.deepEqual(faults(), [
    "tests/browser/picture.spec.ts:1 apps/web/src/copy/via-copy.ts -> apps/web/src/copy/limit-copy.ts -> @airdesign/doom (a package that exports only to import)",
  ])
  rmSync(path.join(root, "tests/browser/picture.spec.ts"))

  write("tests/browser/lazy-doom.spec.ts", 'export const load = () => import("../../packages/doom/src/index.ts")')
  assert.deepEqual(faults(), [
    "tests/browser/clean.spec.ts:5 packages/doom/src/index.ts (also loaded by import() or from an .mjs file)",
  ])
  rmSync(path.join(root, "tests/browser/lazy-doom.spec.ts"))

  write("scripts/bench.mjs", 'import { limits } from "../packages/doom/src/index.ts"\nexport const kept = limits')
  assert.deepEqual(faults(), [
    "tests/browser/clean.spec.ts:5 packages/doom/src/index.ts (also loaded by import() or from an .mjs file)",
  ])
} finally {
  rmSync(root, { recursive: true, force: true })
}

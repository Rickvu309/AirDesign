import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { toolingTests } from "./tooling-tests.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-tooling-tests-"))
try {
  fs.mkdirSync(path.join(root, "scripts"))
  for (const name of ["zeta.test.mjs", "alpha.test.mjs", "alpha.mjs", "beta.test.ts"]) {
    fs.writeFileSync(path.join(root, "scripts", name), "")
  }
  same("the lint rule tests, then every script test in name order", toolingTests(root), [
    "tooling/oxlint-plugin-airdesign/run-tests.js",
    "scripts/alpha.test.mjs",
    "scripts/zeta.test.mjs",
  ])
  fs.writeFileSync(path.join(root, "scripts", "new.test.mjs"), "")
  same("a new script test runs with no list to edit", toolingTests(root).includes("scripts/new.test.mjs"), true)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

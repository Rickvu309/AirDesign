import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { nodeMismatch, pinnedMajor } from "./node-version.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("the same major as .node-version passes", () => {
  assert.equal(nodeMismatch("v24.22.3", "24"), undefined)
})

test("another major is refused with the fix named", () => {
  const message = nodeMismatch("v26.13.0", "24")
  assert.match(message ?? "", /Node v26\.13\.0.*Node 24.*nvm use 24/)
})

test("the pin is the major in .node-version", () => {
  assert.match(pinnedMajor(root), /^\d+$/)
})

test("requirePinnedNode exits 1 with the fix on another major", () => {
  const module = JSON.stringify(path.join(root, "scripts/node-version.mjs"))
  const probe = `import { requirePinnedNode } from ${module}; requirePinnedNode("v26.13.0", "24")`
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe], { encoding: "utf8" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /nvm use 24/)
})

for (const pin of ["24", "24.22.3", "v24.22.3", "v24", " v24.22.3\n"]) {
  test(`the pin ${JSON.stringify(pin)} reads as major 24`, () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "node-pin-"))
    fs.writeFileSync(path.join(folder, ".node-version"), pin)
    assert.equal(pinnedMajor(folder), "24")
  })
}

for (const config of ["playwright.config.ts", "playwright.journeys.config.mts", "playwright.production.config.ts"]) {
  test(`${config} calls requirePinnedNode`, () => {
    assert.match(fs.readFileSync(path.join(root, config), "utf8"), /^requirePinnedNode\(\)$/m)
  })
}

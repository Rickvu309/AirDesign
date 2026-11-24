import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
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

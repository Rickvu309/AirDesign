import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { nodeMismatch, pinnedMajor } from "./node-version.cjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pin = pinnedMajor(root)
const otherMajor = String(Number(pin) + 2)
const guard = JSON.stringify(path.join(root, "scripts/node-version.cjs"))

const inFolder = (contents, body) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "node-version-"))
  try {
    for (const [name, text] of Object.entries(contents)) fs.writeFileSync(path.join(folder, name), text)
    return body(folder)
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
}

const guardFrom = (cwd, running) => {
  const probe = `import { requirePinnedNode } from ${guard}; requirePinnedNode(${JSON.stringify(running)})`
  return spawnSync(process.execPath, ["--input-type=module", "-e", probe], { cwd, encoding: "utf8" })
}

const playwright = path.join(root, "node_modules/@playwright/test/cli.js")
const loadConfig = (cwd, file) =>
  file.startsWith("playwright")
    ? spawnSync(
        process.execPath,
        [playwright, "test", "--list", "--config", path.join(root, file), "no-such-spec-file"],
        { cwd, encoding: "utf8" },
      )
    : spawnSync(
        process.execPath,
        ["--input-type=module", "-e", `await import(${JSON.stringify(path.join(root, file))})`],
        { cwd, encoding: "utf8" },
      )

test("the same major as .node-version passes", () => {
  assert.equal(nodeMismatch("v24.22.3", "24"), undefined)
})

test("another major is refused with the fix named", () => {
  const message = nodeMismatch("v26.13.0", "24")
  assert.match(message ?? "", /Node v26\.13\.0.*Node 24.*nvm use 24/)
})

test("the pin is the major in .node-version", () => {
  assert.match(pin, /^\d+$/)
})

test("a v-prefixed pin names its major", () => {
  inFolder({ ".node-version": "v24.22.3\n" }, (folder) => assert.equal(pinnedMajor(folder), "24"))
})

test("requirePinnedNode exits 1 with the fix on another major", () => {
  const result = guardFrom(root, `v${otherMajor}.0.0`)
  assert.equal(result.status, 1)
  assert.match(result.stderr, new RegExp(`nvm use ${pin}`))
})

test("the guard accepts the pinned major from a folder with no pin", () => {
  inFolder({}, (folder) => {
    const result = guardFrom(folder, `v${pin}.1.2`)
    assert.equal(result.status, 0, result.stderr)
  })
})

test("a decoy .node-version in the working folder does not change the pin", () => {
  inFolder({ ".node-version": otherMajor }, (folder) => {
    const result = guardFrom(folder, `v${otherMajor}.0.0`)
    assert.equal(result.status, 1)
    assert.match(result.stderr, new RegExp(`nvm use ${pin}`))
  })
})

for (const file of [
  "vitest.config.mts",
  "playwright.config.ts",
  "playwright.journeys.config.mts",
  "playwright.production.config.ts",
]) {
  test(
    `${file} loads on the pinned Node from a folder with no pin`,
    { skip: process.version.split(".")[0] !== `v${pin}` },
    () => {
      inFolder({}, (folder) => {
        const result = loadConfig(folder, file)
        if (file.startsWith("playwright")) assert.match(result.stdout + result.stderr, /No tests found/)
        else assert.equal(result.status, 0, result.stderr)
      })
    },
  )
}

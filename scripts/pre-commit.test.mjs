import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { installHooks, preCommitHook } from "./install-hooks.mjs"
import { formatWhole, unparsed } from "./pre-commit.mjs"

const source = path.resolve(import.meta.dirname, "..")
const root = fs.mkdtempSync(path.join(os.tmpdir(), "pre-commit-"))
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" })
const commit = () => spawnSync("git", ["commit", "-qm", "Format staged files"], { cwd: root, encoding: "utf8" })
const historical = `await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "Report.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: Buffer.from("held"),
    })
`
try {
  git("init", "-q")
  git("config", "user.name", "Fixture")
  git("config", "user.email", "fixture@example.com")
  git("config", "commit.gpgsign", "false")
  fs.mkdirSync(path.join(root, "scripts"))
  fs.copyFileSync(path.join(source, "scripts/pre-commit.mjs"), path.join(root, "scripts/pre-commit.mjs"))
  fs.copyFileSync(path.join(source, ".oxfmtrc.json"), path.join(root, ".oxfmtrc.json"))
  fs.symlinkSync(path.join(source, "node_modules"), path.join(root, "node_modules"), "dir")
  installHooks(root)
  assert.equal(fs.readFileSync(path.join(root, ".git/hooks/pre-commit"), "utf8"), preCommitHook)
  const file = "home sections.spec.ts"
  fs.writeFileSync(path.join(root, file), historical)
  git("add", "--", file)
  const first = commit()
  assert.equal(first.status, 0, first.stderr)
  const committed = git("show", `HEAD:${file}`)
  assert.notEqual(committed, historical)
  assert.equal(spawnSync(path.join(source, "node_modules/.bin/oxfmt"), ["--check", file], { cwd: root }).status, 0)
  fs.writeFileSync(path.join(root, file), historical)
  git("add", "--", file)
  fs.writeFileSync(path.join(root, file), committed)
  const kept = commit()
  assert.equal(kept.status, 0, kept.stderr)
  assert.ok(kept.stderr.includes(`left ${file} as staged: it has unstaged changes.`), kept.stderr)
  assert.equal(git("show", `HEAD:${file}`), historical)
  assert.equal(fs.readFileSync(path.join(root, file), "utf8"), committed)
  fs.writeFileSync(path.join(root, file), committed)
  git("add", "--", file)
  assert.equal(commit().status, 0)
  fs.writeFileSync(path.join(root, file), `${committed}\nconst unstaged = 1\n`)
  fs.writeFileSync(path.join(root, "other.ts"), "const other=1\n")
  git("add", "other.ts")
  assert.equal(commit().status, 0)
  assert.equal(git("show", `HEAD:${file}`), committed)
  fs.writeFileSync(path.join(root, "CHECKS.md"), "| a  rule | its   check |\n")
  git("add", "CHECKS.md")
  const ignored = commit()
  assert.equal(ignored.status, 0, ignored.stderr)
  assert.equal(git("show", "HEAD:CHECKS.md"), "| a  rule | its   check |\n")
  const half = "export const x = (\n"
  fs.writeFileSync(path.join(root, "half.ts"), half)
  fs.writeFileSync(path.join(root, "whole.ts"), "const whole=1\n")
  git("add", "half.ts", "whole.ts")
  const wip = commit()
  assert.equal(wip.status, 0, wip.stderr)
  assert.ok(wip.stderr.includes("left half.ts as staged: it does not parse yet."), wip.stderr)
  assert.equal(git("show", "HEAD:half.ts"), half)
  assert.equal(git("show", "HEAD:whole.ts"), "const whole = 1\n")
  const many = Array.from({ length: 60 }, (_, at) => `many-${String(at)}.ts`)
  for (const name of many) fs.writeFileSync(path.join(root, name), `const value${name.length}=1\n`)
  fs.writeFileSync(path.join(root, "many-half.ts"), half)
  git("add", ...many, "many-half.ts")
  const big = commit()
  assert.equal(big.status, 0, big.stderr)
  assert.ok(big.stderr.includes("left many-half.ts as staged: it does not parse yet."), big.stderr)
  assert.equal(git("show", "HEAD:many-0.ts"), "const value9 = 1\n")
  fs.unlinkSync(path.join(root, "node_modules"))
  fs.writeFileSync(path.join(root, "other.ts"), "const other=2\n")
  git("add", "other.ts")
  assert.equal(commit().status, 0)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

const calls = []
const counted =
  (broken, { names = true } = {}) =>
  (batch) => {
    calls.push(batch.length)
    const failed = batch.filter((file) => broken.includes(file))
    return failed.length === 0 ? [] : names ? failed : undefined
  }
const sixty = Array.from({ length: 60 }, (_, at) => `file-${String(at)}.ts`)
assert.deepEqual(formatWhole(sixty, counted([])), { formatted: sixty, left: [] })
assert.deepEqual(calls, [60], "sixty files that parse take one formatter run")
calls.length = 0
assert.deepEqual(formatWhole(sixty, counted(["file-7.ts"])).left, ["file-7.ts"])
assert.deepEqual(calls, [60], "a file the run names as unparsed is left out with no second run")
calls.length = 0
assert.deepEqual(formatWhole(sixty, counted(["file-7.ts"], { names: false })).left, ["file-7.ts"])
assert.equal(calls.length, 61, "only a failure that names no file falls back to one run per file")
assert.deepEqual(
  unparsed("  x Expected `)` but found `EOF`\n   ,-[many-half.ts:2:1]\n", ["many-0.ts", "many-half.ts"]),
  ["many-half.ts"],
)

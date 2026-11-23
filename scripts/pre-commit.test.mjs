import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { installHooks, preCommitHook } from "./install-hooks.mjs"

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
  fs.unlinkSync(path.join(root, "node_modules"))
  fs.writeFileSync(path.join(root, "other.ts"), "const other=2\n")
  git("add", "other.ts")
  assert.equal(commit().status, 0)
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

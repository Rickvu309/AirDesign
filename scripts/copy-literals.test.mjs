import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import { stripTypeScriptTypes } from "node:module"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { copyWords, literalFaults, literals, scanCopyLiterals } from "./copy-literals.mjs"

const file = "apps/web/src/copy/history-copy.ts"
const words = copyWords(file, 'export const historyCopy = { undoFill: "Undo fill", shapes: "Shapes" } as const')
assert.equal(words.get("Undo fill").export, "historyCopy.undoFill")
const faults = (before, after) => literalFaults("tests/browser/example.spec.ts", before, after, words)
assert.match(
  faults("", 'page.getByText("Undo fill")')[0],
  /Import historyCopy.undoFill from apps\/web\/src\/copy\/history-copy.ts/,
)
assert.deepEqual(faults('page.getByText("Undo fill")', 'page.getByText("Undo fill")'), [])
assert.equal(faults('const a = "Undo fill"', 'const a = "Undo fill"; const b = "Undo fill"').length, 1)
assert.deepEqual(faults('const a = "Undo fill"', "page.getByText(historyCopy.undoFill)"), [])
assert.deepEqual(faults("", 'page.getByText("unrelated")'), [])
assert.equal(faults("", 'page.getByText("Shapes")').length, 1)
assert.deepEqual(literalFaults("apps/web/src/editor.ts", "", 'const a = "Undo fill"', words), [])
for (const target of [
  "tests/journeys/a.ts",
  ".agents/skills/verify-airdesign/journeys/a.mjs",
  ".agents/skills/verify-airdesign/look/states/a.mjs",
]) {
  assert.equal(literalFaults(target, "", "page.getByText(`Undo fill`)", words).length, 1)
}
const keyWords = copyWords(file, 'export const connectionCopy = { end: "End" }')
assert.deepEqual(literalFaults("tests/browser/keys.spec.ts", "", 'await text.press("End")', keyWords), [])
const slashWords = copyWords(file, 'export const shortcutCopy = { slash: "/" }')
assert.deepEqual(literalFaults("tests/browser/home.spec.ts", "", 'await page.goto("/")', slashWords), [])
assert.equal(literalFaults("tests/browser/home.spec.ts", "", 'page.getByText("/")', slashWords).length, 1)
assert.deepEqual(literalFaults("tests/browser/keys.spec.ts", "", "await page.keyboard.press(`End`)", keyWords), [])
assert.equal(
  literalFaults("tests/browser/keys.spec.ts", "", 'page.getByRole("button", { name: "End" }).press("End")', keyWords)
    .length,
  1,
)
const oldCopy = 'export const unavailableConnect = { body: "Check your connection, then try again." } as const'
const newCopy = 'export const unavailableConnect = { body: "Try again in a moment." } as const'
const connect = "apps/web/src/copy/connect-copy.ts"
const vocabulary = new Map([...copyWords(connect, oldCopy), ...copyWords(connect, newCopy)])
assert.match(
  literalFaults(
    "tests/browser/consent.spec.ts",
    "",
    'page.getByText("Check your connection, then try again.")',
    vocabulary,
  )[0],
  /Import unavailableConnect.body/,
)
assert.deepEqual(
  literalFaults("tests/browser/consent.spec.ts", "", "page.getByText(unavailableConnect.body)", vocabulary),
  [],
)
assert.equal(literals("a.ts", "const a = `Fit (${percent}%)`")[0].value, "Fit (")

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-copy-literals-"))
const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
const write = (file, source) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  fs.writeFileSync(path.join(repo, file), source)
}
try {
  git("init", "--quiet")
  git("config", "user.email", "test@example.com")
  git("config", "user.name", "Test")
  write(connect, oldCopy)
  write("tests/browser/existing.spec.ts", 'page.getByText("Check your connection, then try again.")')
  git("add", ".")
  git("commit", "--quiet", "-m", "Keep existing literals")
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  assert.equal(scanCopyLiterals(repo).existing, 1)
  assert.deepEqual(scanCopyLiterals(repo).faults, [])
  write(connect, newCopy)
  write(
    ".agents/skills/verify-airdesign/look/states/replay.mjs",
    'page.getByText("Check your connection, then try again.")',
  )
  assert.match(scanCopyLiterals(repo).faults[0], /Import unavailableConnect.body/)
  write(".agents/skills/verify-airdesign/look/states/replay.mjs", "page.getByText(unavailableConnect.body)")
  assert.deepEqual(scanCopyLiterals(repo).faults, [])
  git("add", ".")
  git("commit", "--quiet", "-m", "Move to the new copy")
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  for (let each = 0; each < 20; each++) write(`tests/browser/unchanged-${String(each)}.spec.ts`, "page.getByText(`a`)")
  git("add", ".")
  git("commit", "--quiet", "-m", "Add unchanged specs")
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  write("tests/browser/changed.spec.ts", 'page.getByText("Try again in a moment.")')
  const shim = path.join(repo, "..", `git-shim-${path.basename(repo)}`)
  const calls = path.join(shim, "calls")
  fs.mkdirSync(shim)
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim()
  fs.writeFileSync(path.join(shim, "git"), `#!/bin/sh\necho x >> "${calls}"\nexec "${realGit}" "$@"\n`, { mode: 0o755 })
  const searchPath = process.env.PATH
  process.env.PATH = `${shim}${path.delimiter}${searchPath}`
  try {
    const scanned = scanCopyLiterals(repo)
    assert.match(scanned.faults[0], /changed\.spec\.ts/)
    assert.equal(scanned.faults.length, 1)
    const forks = fs.readFileSync(calls, "utf8").trim().split("\n").length
    assert.ok(forks <= 8, `the scan started git ${String(forks)} times; it must not start git once per tested file`)
  } finally {
    process.env.PATH = searchPath
    fs.rmSync(shim, { recursive: true, force: true })
  }
} finally {
  fs.rmSync(repo, { recursive: true, force: true })
}

const replaySource = fs.readFileSync(new URL("./copy-literals-fixtures/connect-031e0607.ts", import.meta.url), "utf8")
const replay = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(replaySource))}`)
assert.equal(replay.claudeConnect.footer, "Returns you to Claude. Disconnect anytime in Settings.")
assert.equal(replay.unavailableConnect.body, "Try again in a moment.")
const currentSource = `export const claudeConnect = { footer: "Returns you to claude.ai. Uses your weekly usage. Disconnect anytime in Settings." }`
const replayWords = new Map([...copyWords(connect, currentSource), ...copyWords(connect, replaySource)])
const stale = 'page.getByText("Returns you to claude.ai. Uses your weekly usage. Disconnect anytime in Settings.")'
const replayFault = literalFaults("tests/browser/consent.spec.ts", "", stale, replayWords)[0]
assert.match(replayFault, /Import claudeConnect.footer/)
console.log(`031e0607 replay: ${replayFault}`)
const migrated = fs.readFileSync(new URL("../tests/browser/consent.spec.ts", import.meta.url), "utf8")
const consentWords = new Map(
  [...replayWords].filter(([, owner]) => owner.export.endsWith(".footer") || owner.export === "refusedConnect"),
)
assert.deepEqual(literalFaults("tests/browser/consent.spec.ts", "", migrated, consentWords), [])
assert.match(migrated, /footer: claudeConnect.footer/)
assert.match(migrated, /footer: claudeCodeConnect.footer/)
assert.match(migrated, /footer: codexConnect.footer/)
assert.match(migrated, /footer: otherConnect\("tool.example"\).footer/)

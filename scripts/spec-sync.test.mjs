import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { specKey } from "./check-specs.mjs"
import { coverOf, driftLines, drifted, movedSince, syncSpec } from "./spec-sync.mjs"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-spec-sync-"))
const cache = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-spec-sync-cache-"))
process.on("exit", () => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(cache, { recursive: true, force: true })
})

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  fs.writeFileSync(path.join(root, file), text)
}
const commit = (message) => {
  git("add", "-A")
  git("commit", "-q", "-m", message)
}

const order = (undoBody, otherBody, undoName = "undoOrder") =>
  [
    "export const decideOrder = (rows: number[]) => rows.length",
    `export function ${undoName}(rows: number[]) {`,
    `  return ${undoBody}`,
    "}",
    "const other = () => " + otherBody,
    "",
  ].join("\n")

git("init", "-q", "-b", "main")
git("config", "user.email", "spec-sync@example.invalid")
git("config", "user.name", "spec-sync test")
write("specs/demo/Demo.tla", "---- MODULE Demo ----\n====\n")
write("specs/demo/Demo.cfg", "INIT Init\n")
write("src/order.ts", order("rows.slice(1)", "1"))
const seeded = coverOf(root, "src/order.ts", ["decideOrder", "undoOrder"])
write("specs/demo/covers.json", `${JSON.stringify({ check: "checks-demo.md#demo", covers: [seeded] }, null, 2)}\n`)
commit("seed")

assert.deepEqual(drifted(root), [])

write("src/order.ts", order("rows.slice(1)", "2"))
commit("change other")
assert.deepEqual(drifted(root), [], "a change elsewhere in the same file is not a drift")
assert.deepEqual(movedSince(root, "HEAD~1"), [])

write("src/order.ts", order("rows.slice(2)", "2"))
assert.deepEqual(movedSince(root, "HEAD"), ["demo"], "--since names a spec whose covered names this branch moved")
commit("change undo")
assert.deepEqual(movedSince(root, "HEAD"), [])
assert.deepEqual(movedSince(root, "HEAD~1"), ["demo"])
assert.deepEqual(movedSince(root, "HEAD~2"), ["demo"])
const changed = drifted(root)
assert.deepEqual(
  changed.map(({ spec, file, names, reason }) => ({ spec, file, names, reason })),
  [{ spec: "demo", file: "src/order.ts", names: ["undoOrder"], reason: "changed" }],
  "a covered function changed without a re-sync is named with its file",
)
const lines = driftLines(changed).join("\n")
assert.match(lines, /^spec-sync demo: undoOrder in src\/order\.ts changed since the spec was synced\.$/m)
assert.match(lines, /pnpm check:specs demo/)
assert.match(lines, /node scripts\/spec-sync\.mjs --sync demo/)
assert.match(lines, new RegExp(`What moved: git diff ${seeded.blob} src/order\\.ts`))

write("src/order.ts", order("rows.slice(2)", "2", "undoAll"))
commit("rename undo")
const renamed = drifted(root)
assert.deepEqual(
  renamed.map(({ spec, file, names, reason }) => ({ spec, file, names, reason })),
  [{ spec: "demo", file: "src/order.ts", names: ["undoOrder"], reason: "missing-name" }],
  "a renamed function is named as missing",
)
assert.match(
  driftLines(renamed).join("\n"),
  /^spec-sync demo: undoOrder in src\/order\.ts no longer exists\. Rename it in specs\/demo\/covers\.json\.$/m,
)

fs.rmSync(path.join(root, "src/order.ts"))
assert.equal(drifted(root)[0].reason, "missing-file")
write("src/order.ts", order("rows.slice(2)", "2"))
commit("bring undo back")

assert.throws(
  () => syncSpec(root, "demo", { cache }),
  /spec-sync demo: no passing TLC result for this spec\. Run pnpm check:specs demo first\./,
  "--sync refuses a spec whose TLC result is missing",
)
const key = specKey(path.join(root, "specs/demo"), "Demo.tla", "Demo.cfg")
fs.writeFileSync(path.join(cache, `${key}.json`), JSON.stringify({ states: 3, passed: false }))
assert.throws(() => syncSpec(root, "demo", { cache }), /no passing TLC result/, "--sync refuses a failed TLC result")
fs.writeFileSync(path.join(cache, `${key}.json`), JSON.stringify({ states: 3, passed: true }))
assert.match(syncSpec(root, "demo", { cache }), /^synced demo at [0-9a-f]{7,}$/)
assert.deepEqual(drifted(root), [], "a synced spec is in step")

console.log("spec-sync tests passed")

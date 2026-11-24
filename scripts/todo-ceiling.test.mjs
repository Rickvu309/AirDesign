import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ceilingFault, mainCeiling, readCeiling, todoEntries } from "./todo-ceiling.mjs"

assert.equal(readCeiling("layers:\n  - app\n"), undefined)
assert.equal(readCeiling("todo_ceiling: 12\n"), 12)
assert.throws(() => readCeiling("todo_ceiling: 1.5\n"), /whole number/)

const listed = {
  "apps/api/src/account": {
    "apps/api/src/account/sign-in-mail.ts": {
      violations: ["privacy"],
      files: ["apps/api/src/sign-in.test.ts", "apps/api/src/testing/filled-account.ts"],
    },
  },
}
assert.equal(todoEntries(listed), 2)
assert.equal(todoEntries(null), 0)

assert.equal(ceilingFault({ count: 4, ceiling: 4, mainCeiling: undefined }), undefined)
assert.equal(ceilingFault({ count: 3, ceiling: 4, mainCeiling: 4 }), "todo_ceiling is 4 but pack_todo.yml lists 3")
assert.match(ceilingFault({ count: 5, ceiling: 5, mainCeiling: 4 }), /above origin\/main \(4\)/)
assert.equal(ceilingFault({ count: 3, ceiling: 3, mainCeiling: 4 }), undefined)
assert.match(ceilingFault({ count: 0, ceiling: undefined, mainCeiling: undefined }), /needs todo_ceiling/)

const repos = fs.mkdtempSync(path.join(os.tmpdir(), "todo-ceiling-"))
try {
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  const origin = path.join(repos, "origin")
  const clone = path.join(repos, "clone")
  fs.mkdirSync(origin, { recursive: true })
  git(origin, "init", "-q", "-b", "main")
  git(origin, "config", "user.email", "t@example.com")
  git(origin, "config", "user.name", "t")
  fs.writeFileSync(path.join(origin, "packwerk.yml"), "todo_ceiling: 7\n")
  git(origin, "add", "-A")
  git(origin, "commit", "-q", "-m", "the ceiling starts")
  git(repos, "clone", "-q", origin, clone)
  fs.writeFileSync(path.join(origin, "packwerk.yml"), "todo_ceiling: 9\n")
  git(origin, "commit", "-q", "-am", "the ceiling shrinks")
  assert.deepEqual(
    mainCeiling(clone),
    { ceiling: 9 },
    "the baseline is the fetched origin/main, not the stale ref the clone kept",
  )
} finally {
  fs.rmSync(repos, { recursive: true, force: true })
}

import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { commitTitle, titleLines } from "./commit-titles.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("the title is the first line", commitTitle("Add undo\n\nThe body.\n"), "Add undo")
same("a message of one line is its title", commitTitle("Add undo\n"), "Add undo")
same(
  "a first paragraph of two lines is one title of two lines, as git reads it",
  commitTitle("Add undo\nand redo\n\nThe body.\n"),
  "Add undo\nand redo",
)

const hash = "a".repeat(40)
same("good titles print nothing", titleLines([{ hash, message: "Add undo\n\nBody.\n" }]), [])
same("a long title is listed with its length and the limit", titleLines([{ hash, message: `${"A".repeat(80)}\n` }]), [
  "commit aaaaaaaa title is 80 characters, limit 72: it is too long",
])
same("a title with no blank line after it is listed", titleLines([{ hash, message: "Add undo\nand redo\n" }]), [
  "commit aaaaaaaa title is 17 characters, limit 72: it is more than one line",
])

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "commit-titles-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const root = path.join(folder, "repo")
fs.mkdirSync(path.join(root, "scripts"), { recursive: true })
const here = path.dirname(fileURLToPath(import.meta.url))
for (const name of ["checked.mjs", "commit-authors.mjs", "commit-titles.mjs", "title.mjs"])
  fs.copyFileSync(path.join(here, name), path.join(root, "scripts", name))
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
git("init", "-q", "-b", "main")
const tree = git("hash-object", "-t", "tree", "-w", "/dev/null")
const commit = (message, parents = []) =>
  execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
    cwd: root,
    encoding: "utf8",
    input: [
      `tree ${tree}`,
      ...parents.map((parent) => `parent ${parent}`),
      "author A <a@b.c> 1700000000 +0000",
      "committer A <a@b.c> 1700000000 +0000",
      "",
      message,
      "",
    ].join("\n"),
  }).trim()
const step = () => spawnSync(process.execPath, ["scripts/commit-titles.mjs"], { cwd: root, encoding: "utf8" })

const base = commit(`${"An old paragraph of a title on main that is far too long to read in a list".repeat(2)}.`)
git("update-ref", "refs/remotes/origin/main", base)
const good = commit("Add undo\n\nThe body says the rest.", [base])
git("update-ref", "HEAD", good)
const passed = step()
same("a branch whose titles pass exits 0", passed.status, 0)
same(
  "and says how many it read",
  passed.stdout,
  "commit-titles: 1 commits since origin/main, every title within the rule\n",
)

const bad = commit("Add undo and redo and the history menu and the toast that says what was undone.", [good])
git("update-ref", "HEAD", bad)
const failed = step()
same("a branch with a broken title exits 1, so the warn step shows it", failed.status, 1)
same(
  "it lists only the branch's own commit",
  failed.stderr.split("\n")[0],
  `commit ${bad.slice(0, 8)} title is 79 characters, limit 72: it is too long; it ends with a full stop`,
)
same("and says how to fix it", failed.stderr.includes("git commit --amend"), true)

git("update-ref", "-d", "refs/remotes/origin/main")
same("with no origin/main it judges nothing and passes", step().status, 0)

console.log("commit-titles tests passed")

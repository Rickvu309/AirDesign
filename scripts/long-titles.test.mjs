import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { longTitles, mainTitles } from "./metrics.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

same("no titles count nothing", longTitles([]), 0)
same("a title of 72 characters is not long", longTitles(["A".repeat(72)]), 0)
same("a title of 73 characters is long", longTitles(["A".repeat(73), "Add undo"]), 1)

const root = fs.mkdtempSync(path.join(os.tmpdir(), "long-titles-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))
const git = (args, input) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim()
git(["init", "-q", "-b", "main"])
const tree = git(["hash-object", "-t", "tree", "-w", "/dev/null"])
const commit = (message, parents) =>
  git(
    ["hash-object", "-t", "commit", "-w", "--stdin"],
    [
      `tree ${tree}`,
      ...parents.map((parent) => `parent ${parent}`),
      "author A <a@b.c> 1700000000 +0000",
      "committer A <a@b.c> 1700000000 +0000",
      "",
      message,
      "",
    ].join("\n"),
  )

let error = ""
try {
  mainTitles(root)
} catch (thrown) {
  error = thrown.message
}
same(
  "with no origin/main it says what to fetch",
  error,
  "long-titles reads origin/main, which is missing. Run git fetch origin main.",
)

let tip = commit("A".repeat(80), [])
for (let at = 0; at < 50; at += 1) tip = commit(at === 0 ? `${"B".repeat(70)}\nmore` : `Add step ${at}`, [tip])
git(["update-ref", "refs/remotes/origin/main", tip])
const titles = mainTitles(root)
same("it reads the last 50 titles on origin/main", titles.length, 50)
same("a title of two lines is read whole, as git reads it", titles.at(-1), `${"B".repeat(70)} more`)
same("so it counts as long, and the 51st commit back is not read", longTitles(titles), 1)

console.log("long-titles tests passed")

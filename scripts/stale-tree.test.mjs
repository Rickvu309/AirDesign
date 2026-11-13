import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runner } from "./land-git.mjs"
import { absent, putBack, revertsNamed, staleFiles, staleFault } from "./stale-tree.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const history = [
  { commit: "c3", subject: "Add the shape menu", entries: [{ path: "menu.ts", before: absent, after: "m1" }] },
  { commit: "c2", subject: "Rename the title", entries: [{ path: "title.ts", before: "t1", after: "t2" }] },
  { commit: "c1", subject: "Drop the old list", entries: [{ path: "list.ts", before: "l1", after: absent }] },
]

same(
  "a file set back to content main replaced is named with the commit that replaced it",
  putBack({ changed: [{ path: "title.ts", blob: "t1" }], history }),
  [{ path: "title.ts", commit: "c2", subject: "Rename the title", deleted: false }],
)
same(
  "deleting a file main added is put back",
  putBack({ changed: [{ path: "menu.ts", blob: absent }], history }).map((each) => each.commit),
  ["c3"],
)
same(
  "adding a file main deleted is put back",
  putBack({ changed: [{ path: "list.ts", blob: "l1" }], history }).map((each) => each.commit),
  ["c1"],
)
same("new content is not put back", putBack({ changed: [{ path: "title.ts", blob: "t3" }], history }), [])
same("a new file is not put back", putBack({ changed: [{ path: "new.ts", blob: "n1" }], history }), [])
same(
  "a file named in a Reverts line is not put back",
  putBack({ changed: [{ path: "title.ts", blob: "t1" }], history, excused: ["title.ts"] }),
  [],
)
same(
  "the newest commit that replaced the content is named",
  putBack({
    changed: [{ path: "a.ts", blob: "a1" }],
    history: [
      { commit: "new", subject: "Second", entries: [{ path: "a.ts", before: "a1", after: "a2" }] },
      { commit: "old", subject: "First", entries: [{ path: "a.ts", before: "a1", after: "a3" }] },
    ],
  }).map((each) => each.commit),
  ["new"],
)

same(
  "a Reverts line names a path, one per line",
  revertsNamed("Undo the menu\n\nReverts: menu.ts\nReverts:  apps/web/a b.ts \nNot Reverts: x\n"),
  ["menu.ts", "apps/web/a b.ts"],
)

const title = { path: "title.ts", commit: "c2c2c2c2c2c2", subject: "Rename the title", deleted: false }
const list = { path: "list.ts", commit: "c1c1c1c1c1c1", subject: "Drop the old list", deleted: false }
const menu = { path: "menu.ts", commit: "c3c3c3c3c3c3", subject: "Add the shape menu", deleted: true }
same("no file put back is no fault", staleFault([]), undefined)
same("one file put back can be a revert and is no fault", staleFault([title]), undefined)
same(
  "files main added and the branch deletes do not count toward the limit",
  staleFault([title, menu, { ...menu, path: "shape.ts" }]),
  undefined,
)
const fault = staleFault([title, list, menu])
for (const [what, part] of [
  ["names each file", "title.ts"],
  ["names the commit it undoes", "title.ts: back to its content before c2c2c2c2 Rename the title"],
  ["says why", "stale tree"],
  ["says how to go back to the pushed branch", "git reset --hard"],
  ["names a deleted file too", "menu.ts: deleted, as it was before c3c3c3c3"],
  [
    "says how to restore the files",
    "git restore --source=origin/main --staged --worktree -- title.ts list.ts menu.ts && git commit --amend",
  ],
  ["says how to keep a real revert", "Reverts: <path>"],
])
  same(`the fault ${what}`, fault.includes(part), true)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "stale-tree-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const identity = ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false"]
const raw = (...args) =>
  execFileSync("git", [...identity, ...args], {
    cwd: folder,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
const write = (name, text) => fs.writeFileSync(path.join(folder, name), text)
const commitAll = (subject) => {
  raw("add", "-A")
  raw("commit", "-q", "-m", subject)
  return raw("rev-parse", "HEAD")
}

raw("init", "-q", "-b", "main")
write("title.ts", "one\n")
write("list.ts", "list\n")
write("feature.ts", "plain\n")
const start = commitAll("Start")
write("feature.ts", "mine\n")
const feature = commitAll("Make the feature")
raw("switch", "-q", "--detach", start)
for (let at = 0; at < 10; at += 1) {
  if (at === 3) write("title.ts", "two\n")
  else if (at === 5) fs.rmSync(path.join(folder, "list.ts"))
  else write(`main-${at}.ts`, `${at}\n`)
  commitAll(`Main ${at}`)
}
const tip = raw("rev-parse", "HEAD")
raw("update-ref", "refs/remotes/origin/main", tip)
const git = runner("git", folder)

const stale = raw("commit-tree", `${feature}^{tree}`, "-p", tip, "-m", "Make the feature")
const named = staleFiles(git, { head: stale })
same(
  "a squash rebuilt from the tree before main moved puts back what main changed",
  named.map((each) => each.path),
  [
    "list.ts",
    "main-0.ts",
    "main-1.ts",
    "main-2.ts",
    "main-4.ts",
    "main-6.ts",
    "main-7.ts",
    "main-8.ts",
    "main-9.ts",
    "title.ts",
  ],
)
same("and stops", staleFault(named) !== undefined, true)
const many = Array.from({ length: 25 }, (_, at) => ({ ...title, path: `f${at}.ts` }))
same("a long list shows 20 files and counts the rest", staleFault(many).includes("  and 5 more"), true)
same("and the restore still names every file", staleFault(many).includes("f24.ts && git commit"), true)
same("and names the main commit each file undoes", named.find((each) => each.path === "title.ts").subject, "Main 3")

same("a branch main moved past is not stale", staleFiles(git, { head: feature }), [])

raw("switch", "-q", "--detach", tip)
raw("cherry-pick", feature)
same("the same change rebased onto main is not stale", staleFiles(git, { head: "HEAD" }), [])

write("title.ts", "one\n")
commitAll("Put the old title back\n\nReverts: title.ts")
same("a revert named in the commit body is not stale", staleFiles(git, { head: "HEAD" }), [])

write("list.ts", "list\n")
commitAll("Bring the list back")
same(
  "a file put back without a Reverts line is named",
  staleFiles(git, { head: "HEAD" }).map((each) => each.path),
  ["list.ts"],
)
same("the window is counted in commits of main", staleFiles(git, { head: "HEAD", depth: 4 }), [])

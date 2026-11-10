import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { findStale, idleBefore, readWorktrees, removeStale, staleReason } from "./worktrees.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "worktrees-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
const configured = (key) => {
  try {
    return execFileSync("git", ["config", key], { encoding: "utf8" }).trim()
  } catch {
    return ""
  }
}
const identity =
  configured("user.email") === "" ? ["-c", "user.name=fixture", "-c", "user.email=fixture@example.com"] : []
const git = (cwd, ...args) =>
  execFileSync("git", [...identity, "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
const root = path.join(folder, "repo")
const remote = path.join(folder, "remote.git")
fs.mkdirSync(root)
git(folder, "init", "-q", "--bare", remote)
git(root, "init", "-q", "-b", "main")
const commit = (cwd, file, text) => {
  fs.writeFileSync(path.join(cwd, file), text)
  git(cwd, "add", file)
  git(cwd, "commit", "-q", "-m", file)
  return git(cwd, "rev-parse", "HEAD").trim()
}
commit(root, "a.txt", "a")
git(root, "remote", "add", "origin", remote)
git(root, "push", "-q", "-u", "origin", "main")

const tree = (name) => {
  const where = path.join(folder, name)
  git(root, "worktree", "add", "-q", "-b", name, where, "main")
  return where
}
const landed = tree("landed")
const landedCommit = commit(landed, "landed.txt", "landed")
git(root, "cherry-pick", "-x", landedCommit)
const open = tree("open")
commit(open, "open.txt", "open")
const dirty = tree("dirty")
git(root, "cherry-pick", "-x", commit(dirty, "dirty.txt", "dirty"))
fs.writeFileSync(path.join(dirty, "unsaved.txt"), "unsaved")
const fresh = tree("fresh")
const busy = tree("busy")
git(root, "cherry-pick", "-x", commit(busy, "busy.txt", "busy"))
const locked = tree("locked")
git(root, "cherry-pick", "-x", commit(locked, "locked.txt", "locked"))
git(root, "worktree", "lock", locked)
const closed = tree("closed")
commit(closed, "closed.txt", "closed")
git(closed, "push", "-q", "-u", "origin", "closed")
git(root, "push", "-q", "origin", "--delete", "closed")
git(root, "fetch", "-q", "--prune", "origin")

const isBusy = (where) => where === busy
const names = (list) => list.map((worktree) => path.basename(worktree.path)).sort()
same("only clean, idle work that is done counts as stale", names(findStale({ root, base: "main", busy: isBusy })), [
  "closed",
  "landed",
])
same(
  "a worktree with no work of its own counts once it sat idle",
  names(findStale({ root, base: "main", busy: isBusy, now: Date.now() + idleBefore + 60_000 })),
  ["closed", "fresh", "landed"],
)

same(
  "work on main is stale",
  staleReason({ commits: { total: 1, unlanded: 0 }, gone: false, idle: false }),
  "its work is on main",
)
same("open work is kept", staleReason({ commits: { total: 2, unlanded: 1 }, gone: false, idle: true }), undefined)
same(
  "a gone branch is stale",
  staleReason({ commits: { total: 1, unlanded: 1 }, gone: true, idle: false }),
  "its branch is gone from GitHub",
)
same(
  "a fresh worktree is kept",
  staleReason({ commits: { total: 0, unlanded: 0 }, gone: false, idle: false }),
  undefined,
)
same("an unreadable worktree is kept", staleReason({ commits: undefined, gone: false, idle: true }), undefined)

same(
  "the porcelain list is read",
  readWorktrees("worktree /a\nHEAD 1\nbranch refs/heads/x\n\nworktree /b\nHEAD 2\ndetached\nlocked why\n"),
  [
    { path: "/a", head: "1", branch: "refs/heads/x", locked: false },
    { path: "/b", head: "2", locked: true },
  ],
)

const said = []
const removed = removeStale({ root, base: "main", busy: isBusy, say: (line) => said.push(line) })
same("removing takes away exactly the stale worktrees", removed.map((where) => path.basename(where)).sort(), [
  "closed",
  "landed",
])
same("each removal says why", said.length, 2)
same(
  "the folders are gone",
  [landed, closed].map((where) => fs.existsSync(where)),
  [false, false],
)
same(
  "the kept folders stay",
  [open, dirty, fresh, busy, locked].map((where) => fs.existsSync(where)),
  [true, true, true, true, true],
)
const branches = git(root, "branch", "--format=%(refname:short)").split("\n").filter(Boolean).sort()
same("a landed branch is deleted and a closed one is kept", branches.includes("landed"), false)
same("a closed branch keeps its commits", branches.includes("closed"), true)

console.log("worktrees tests passed")

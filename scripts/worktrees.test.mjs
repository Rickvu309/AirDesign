import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  bringMainUp,
  findStale,
  idleBefore,
  readWorktrees,
  removeStale,
  removeStaleBranches,
  staleBranches,
  staleReason,
  warnStashes,
} from "./worktrees.mjs"

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

same(
  "a detached worktree on merged work stays while it is in use, like a verifier judging that commit",
  staleReason({ commits: { total: 1, unlanded: 0 }, gone: false, idle: false, detached: true }),
  undefined,
)
same(
  "a detached worktree on merged work goes once it sat idle",
  staleReason({ commits: { total: 1, unlanded: 0 }, gone: false, idle: true, detached: true }),
  "its work is on main",
)

git(root, "branch", "pointer", "main")
git(root, "branch", "spent", "main")
git(root, "checkout", "-q", "spent")
const spentCommit = commit(root, "spent.txt", "spent")
git(root, "checkout", "-q", "main")
git(root, "cherry-pick", "-x", spentCommit)
git(root, "branch", "unfinished", "main")
git(root, "checkout", "-q", "unfinished")
commit(root, "unfinished.txt", "unfinished")
git(root, "checkout", "-q", "main")
same("a branch with no worktree is stale when it holds nothing main lacks", staleBranches({ root, base: "main" }), [
  "pointer",
  "spent",
])
const saidBranches = []
same(
  "the stale branches are deleted",
  removeStaleBranches({ root, base: "main", say: (line) => saidBranches.push(line) }),
  ["pointer", "spent"],
)
same("each deleted branch is named", saidBranches, [
  "deleted branch pointer, because it holds nothing main lacks",
  "deleted branch spent, because it holds nothing main lacks",
])
const left = git(root, "branch", "--format=%(refname:short)").split("\n").filter(Boolean).sort()
same("main, unfinished work and branches in a worktree stay", left, [
  "busy",
  "closed",
  "dirty",
  "fresh",
  "locked",
  "main",
  "open",
  "unfinished",
])

const clone = path.join(folder, "clone")
git(folder, "clone", "-q", "-b", "main", remote, clone)
git(root, "push", "-q", "origin", "main")
git(clone, "fetch", "-q", "origin")
const tip = git(root, "rev-parse", "main").trim()
same("a clean main checkout is brought up to origin/main", bringMainUp({ root: clone }), true)
same("it now sits on the tip", git(clone, "rev-parse", "HEAD").trim(), tip)
same("a main checkout that is already there is left alone", bringMainUp({ root: clone }), false)
git(clone, "checkout", "-q", "-b", "side")
same("a checkout on another branch is left alone", bringMainUp({ root: clone }), false)
git(clone, "checkout", "-q", "main")
git(clone, "reset", "-q", "--hard", "HEAD~1")
fs.writeFileSync(path.join(clone, "unsaved.txt"), "unsaved")
same("a main checkout with unsaved work is left alone", bringMainUp({ root: clone }), false)

same("an empty stash list stays quiet", warnStashes({ root, say: () => {} }), [])

const saved = tree("saved")
fs.writeFileSync(path.join(saved, "a.txt"), "saved work")
git(saved, "stash", "push", "-m", `leftover from ${saved} (saved), saved 2026-11-16 cleanup`)
const held = tree("held")
fs.writeFileSync(path.join(held, "a.txt"), "held work")
git(held, "stash", "push", "-m", held)
const branchOnly = tree("branch-only")
fs.writeFileSync(path.join(branchOnly, "a.txt"), "branch work")
git(branchOnly, "stash", "push")
git(root, "worktree", "remove", saved)
git(root, "worktree", "remove", branchOnly)
const beforeStashes = git(root, "stash", "list", "--format=%H %gs")
const beforePatch = git(root, "stash", "show", "-p", "stash@{2}")
const warnings = []
const warned = warnStashes({ root, say: (line) => warnings.push(line) })
same("removed source worktrees warn, while a held source stays quiet", warned.length, 2)
same("a default WIP stash names its branch without a worktree", warnings[0].includes("branch-only"), true)
same("the historical cleanup message names the gone source path", warnings[1].includes(saved), true)
same("warnings identify the stash entry", warnings[1].includes("stash@{2}"), true)
same("warnings offer a read-only way to inspect the saved patch", warnings[1].includes("git stash show -p"), true)
same(
  "warning leaves every stash hash and message unchanged",
  git(root, "stash", "list", "--format=%H %gs"),
  beforeStashes,
)
same("warning leaves the saved patch unchanged", git(root, "stash", "show", "-p", "stash@{2}"), beforePatch)
git(root, "worktree", "add", "-q", saved, "saved")
same("a restored source path and branch stops warning", warnStashes({ root, say: () => {} }).length, 1)
git(root, "branch", "-D", "branch-only")
same("a deleted source branch still warns", warnStashes({ root, say: () => {} }).length, 1)

const missing = path.join(folder, "missing source")
fs.writeFileSync(path.join(held, "a.txt"), "another patch")
git(held, "stash", "push", "-m", `worktree: ${missing}`)
const pathWarnings = warnStashes({ root, say: () => {} })
same("a missing named path warns even when the branch has a worktree", pathWarnings.length, 2)
same("a named path with spaces survives the stash message", pathWarnings[0].includes(missing), true)
console.log("worktrees tests passed")

import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { findStale, idleBefore, recentFor, usedByAProcess } from "./worktrees.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const repo = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-guards-"))
process.on("exit", () => fs.rmSync(repo, { recursive: true, force: true }))
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
const root = path.join(repo, "repo")
fs.mkdirSync(root)
git(root, "init", "-q", "-b", "main")
const commit = (cwd, file, text) => {
  fs.writeFileSync(path.join(cwd, file), text)
  git(cwd, "add", file)
  git(cwd, "commit", "-q", "-m", file)
  return git(cwd, "rev-parse", "HEAD").trim()
}
commit(root, "a.txt", "a")
const add = (name) => {
  const where = path.join(repo, name)
  git(root, "worktree", "add", "-q", "-b", name, where, "main")
  return where
}
const later = Date.now() + idleBefore + 60_000
const stale = (where, extra = {}) =>
  findStale({ root, base: "main", now: later, ...extra }).some((worktree) => worktree.path === where)

const held = add("held")
const openFile = fs.openSync(path.join(held, "a.txt"), "r")
same("a worktree a process holds a file open in, its cwd elsewhere, is busy", stale(held), false)
fs.closeSync(openFile)

const relative = add("relative")
fs.writeFileSync(
  path.join(relative, ".git"),
  `gitdir: ${path.relative(relative, path.join(root, ".git", "worktrees", "relative"))}\n`,
)
same(
  "a fresh worktree whose .git pointer is relative is not idle, wherever the sweep runs from",
  stale(relative, { now: Date.now() }),
  false,
)
same("and the idle guard still sweeps it once it has been quiet", stale(relative, { busy: () => false }), true)

const rebasing = add("rebasing")
commit(rebasing, "rebasing.txt", "paused")
execFileSync("git", [...identity, "-c", "commit.gpgsign=false", "rebase", "-i", "main"], {
  cwd: rebasing,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  env: { ...process.env, GIT_SEQUENCE_EDITOR: 'sed -i "1i break"' },
})
same(
  "a clean worktree paused mid-rebase stays, though its head is on main",
  stale(rebasing, { busy: () => false }),
  false,
)
const bisecting = add("bisecting")
git(bisecting, "bisect", "start", "HEAD")
same("a clean worktree mid-bisect stays, though its head is on main", stale(bisecting, { busy: () => false }), false)

const picking = add("picking")
const sequencer = path.join(root, ".git", "worktrees", "picking", "sequencer")
fs.mkdirSync(sequencer)
same(
  "a worktree git leaves a sequencer in stays, though its head is on main",
  stale(picking, { busy: () => false }),
  false,
)
fs.rmdirSync(sequencer)
same("and it sweeps once the sequence is gone", stale(picking, { busy: () => false }), true)

const guarded = add("guarded")
const fakeProc = () => {
  const where = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-guards-proc-"))
  process.on("exit", () => fs.rmSync(where, { recursive: true, force: true }))
  const dir = fs.mkdirSync(path.join(where, "101"), { recursive: true })
  fs.writeFileSync(path.join(dir, "cwd"), "")
  fs.mkdirSync(path.join(dir, "fd"))
  fs.writeFileSync(path.join(dir, "fd", "3"), "")
  return where
}
const churning = fakeProc()
fs.symlinkSync(guarded, path.join(churning, "101", "fd", "7"))
same(
  "a worktree an open fd holds is busy, though the cwd and an earlier fd cannot be read",
  usedByAProcess(guarded, churning),
  true,
)
const naming = fakeProc()
fs.writeFileSync(path.join(naming, "101", "cmdline"), `node\0${guarded}\0`)
same(
  "a worktree a command line names is busy, though the cwd and an fd cannot be read",
  usedByAProcess(guarded, naming),
  true,
)
same(
  "a worktree such a process holds is not stale, though it sat idle with no work of its own",
  stale(guarded, { busy: (where) => usedByAProcess(where, churning) }),
  false,
)

const named = add("named")
const started = path.join(repo, "named-started")
const namingProcess = spawn(
  process.execPath,
  ["-e", "require('node:fs').writeFileSync(process.argv[1], 'ready'); setTimeout(() => {}, 30000)", started, named],
  { stdio: "ignore" },
)
process.on("exit", () => namingProcess.kill())
const until = Date.now() + 10_000
while (!fs.existsSync(started)) {
  if (Date.now() > until) throw new Error("the process naming a worktree on its command line never started")
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
}
same("a worktree a process names only on its command line is busy", stale(named), false)
namingProcess.kill()

const outside = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-guards-remote-"))
process.on("exit", () => fs.rmSync(outside, { recursive: true, force: true }))
const remote = path.join(outside, "remote.git")
const checkout = path.join(outside, "checkout")
const pushedTree = path.join(outside, "pushed")
git(outside, "init", "-q", "--bare", remote)
fs.mkdirSync(checkout)
git(checkout, "init", "-q", "-b", "main")
commit(checkout, "a.txt", "a")
git(checkout, "remote", "add", "origin", remote)
git(checkout, "push", "-q", "-u", "origin", "main")
git(checkout, "worktree", "add", "-q", "-b", "pushed", pushedTree, "main")
const pushedHead = commit(pushedTree, "pushed.txt", "pushed")
git(pushedTree, "push", "-q", "-u", "origin", "pushed")
const vanished = path.join(outside, "vanished")
git(checkout, "worktree", "add", "-q", "--detach", vanished, pushedHead)
git(remote, "branch", "-D", "pushed")
const raw = fs.readFileSync(path.join(vanished, ".git"), "utf8").replace("gitdir:", "").trim()
const gitdir = path.isAbsolute(raw) ? raw : path.resolve(vanished, raw)
const when = new Date(Date.now() - recentFor - 60_000)
for (const name of ["HEAD", "index"]) fs.utimesSync(path.join(gitdir, name), when, when)
same(
  "a worktree whose commit only a remote-tracking ref of a deleted remote branch holds stays",
  findStale({ root: checkout, now: Date.now(), busy: () => false }).some((worktree) => worktree.path === vanished),
  false,
)

const stranded = path.join(outside, "stranded")
git(checkout, "worktree", "add", "-q", "-b", "stranded", stranded, "main")
commit(stranded, "stranded.txt", "stranded")
git(stranded, "push", "-q", "-u", "origin", "stranded")
git(checkout, "remote", "set-url", "origin", path.join(outside, "gone.git"))
const strandedRaw = fs.readFileSync(path.join(stranded, ".git"), "utf8").replace("gitdir:", "").trim()
const strandedGitdir = path.isAbsolute(strandedRaw) ? strandedRaw : path.resolve(stranded, strandedRaw)
for (const name of ["HEAD", "index"]) fs.utimesSync(path.join(strandedGitdir, name), when, when)
same(
  "a worktree whose remote is unreachable stays, though its branch is on it",
  findStale({ root: checkout, now: Date.now(), busy: () => false }).some((worktree) => worktree.path === stranded),
  false,
)

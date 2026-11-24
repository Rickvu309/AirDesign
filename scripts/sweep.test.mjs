import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { listedRecently, listingMinutes, sweep, sweepPull } from "./sweep.mjs"
import { findStale, idleBefore, recentFor } from "./worktrees.mjs"

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-test-"))
try {
  const stamp = path.join(folder, "nested", "sweep-listed")
  const now = Date.now()
  assert.equal(listedRecently({ stamp, now, minutes: 30 }), false, "a machine never listed has nothing recent")
  fs.mkdirSync(path.dirname(stamp))
  fs.writeFileSync(stamp, "")
  assert.equal(listedRecently({ stamp, now: Date.now(), minutes: 30 }), true, "a list just made is recent")
  const old = new Date(now - 31 * 60_000)
  fs.utimesSync(stamp, old, old)
  assert.equal(listedRecently({ stamp, now, minutes: 30 }), false, "a list older than the gap is due again")
  assert.equal(listedRecently({ stamp, now, minutes: 45 }), true, "and still recent inside a longer gap")
  assert.equal(listingMinutes(["--at-most-every=30"]), 30)
  assert.equal(listingMinutes(["--apply"]), undefined)
  assert.equal(listingMinutes([]), undefined)
  assert.throws(() => listingMinutes(["--at-most-every=soon"]), /minutes/)
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const repo = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-pull-"))
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
const scratchRoot = path.join(repo, "verify-airdesign-scratch")
fs.mkdirSync(scratchRoot)
const detach = (name, at) => {
  const where = path.join(scratchRoot, name)
  git(root, "worktree", "add", "-q", "--detach", where, at)
  return where
}
const only = add("only")
commit(only, "only.txt", "only")
git(root, "worktree", "remove", only)
const fresh = add("fresh")
const busy = add("busy")
const dirty = add("dirty")
fs.writeFileSync(path.join(dirty, "unsaved.txt"), "unsaved")
const inside = add("inside")
const insideHead = commit(inside, "inside.txt", "inside")
const insideScratch = detach("tree-inside", insideHead)
const feature = add("feature")
const mid = commit(feature, "mid.txt", "mid")
const midScratch = detach("tree-mid", mid)
commit(feature, "tip.txt", "tip")
const tipScratch = detach("tree-tip", "feature")
const sharedScratch = detach("tree-main", "main")
const other = add("other")
const otherHead = commit(other, "other.txt", "other")
const otherScratch = detach("tree-other", otherHead)
const lockedTree = add("locked")
const lockedHead = commit(lockedTree, "locked.txt", "locked")
git(root, "worktree", "lock", lockedTree)
const ahead = add("ahead")
const aheadLanded = commit(ahead, "ahead.txt", "ahead")
commit(ahead, "ahead-extra.txt", "extra")
const orphan = add("orphan")
const orphanLanded = commit(orphan, "orphan.txt", "orphan")
commit(orphan, "orphan-extra.txt", "extra")
git(root, "worktree", "remove", orphan)
const older = add("older")
const olderTip = commit(older, "older.txt", "older")
const olderMerged = commit(older, "older-child.txt", "child")
git(older, "reset", "-q", "--hard", olderTip)
const based = add("based")
const basedHead = commit(based, "based.txt", "based")
const basedScratch = detach("tree-based", basedHead)
const strayScratch = detach("tree-stray", "main")
const own = add("own")
const ownHead = commit(own, "own.txt", "own")
const primary = path.join(repo, "primary")
fs.mkdirSync(primary)
git(primary, "init", "-q", "-b", "main")
commit(primary, "p.txt", "p")
git(primary, "checkout", "-q", "-b", "held")

const branches = () => git(root, "branch", "--format=%(refname:short)").split("\n").filter(Boolean)
const later = Date.now() + idleBefore + 60_000
same(
  "the full sweep would remove a fresh worktree that sat idle with no work of its own",
  findStale({ root, base: "main", busy: () => false, now: later, scratchRoot })
    .map((worktree) => path.basename(worktree.path))
    .includes("fresh"),
  true,
)

const run = (branch, extra = {}) => {
  const lines = []
  sweepPull({
    root,
    branch,
    number: extra.number ?? 12,
    head: extra.head,
    here: extra.here ?? root,
    base: extra.base ?? "main",
    scratchRoot,
    busy: extra.busy ?? (() => false),
    say: (line) => lines.push(line),
  })
  return lines
}

const onlyHead = git(root, "rev-parse", "refs/heads/only").trim()
const onlyLines = run("only", { number: 4, head: onlyHead })
same("a merged pull request's branch goes when no worktree holds it", onlyLines, [
  "deleted branch only, because its pull request 4 is merged",
])
same("and the branch ref is gone", branches().includes("only"), false)

const busyLines = run("busy", { head: git(busy, "rev-parse", "HEAD").trim(), busy: (where) => where === busy })
same("a worktree a process is using stays", fs.existsSync(busy), true)
same("and one line says why and how to remove it", busyLines, [
  `left worktree ${busy}, because a process is using it. Remove it with: git -C ${root} worktree remove ${busy} && git -C ${root} branch -D busy`,
])
same("its branch stays while the worktree does", branches().includes("busy"), true)

const dirtyLines = run("dirty", { head: git(dirty, "rev-parse", "HEAD").trim() })
same("a worktree with uncommitted changes stays", fs.existsSync(dirty), true)
same("and one line says why and how to remove it", dirtyLines, [
  `left worktree ${dirty}, because it has uncommitted changes. Remove it with: git -C ${root} worktree remove ${dirty} && git -C ${root} branch -D dirty`,
])

const insideLines = run("inside", { number: 8, here: inside, head: insideHead })
same("the worktree land is running in stays", fs.existsSync(inside), true)
same("and the line is the one command that removes it", insideLines, [
  `left worktree ${inside}, because land is running there. Remove it with: git -C ${root} worktree remove ${inside} && git -C ${root} branch -D inside`,
  `removed worktree ${insideScratch}, because it is a verify-airdesign scratch tree of pull request 8`,
])
same("a scratch tree of that same pull request still goes", fs.existsSync(insideScratch), false)
same("the branch stays while land's worktree holds it", branches().includes("inside"), true)
same(
  "pnpm sweep leaves that worktree while a process is using it",
  findStale({
    root,
    base: "main",
    busy: (where) => where === inside,
    now: later,
    scratchRoot,
    pulls: new Map([[insideHead, { number: 8, state: "MERGED" }]]),
  }).some((worktree) => worktree.path === inside),
  false,
)
same(
  "pnpm sweep picks that worktree up once it has been quiet and no process is using it",
  findStale({
    root,
    base: "main",
    busy: () => false,
    now: later,
    scratchRoot,
    pulls: new Map([[insideHead, { number: 8, state: "MERGED" }]]),
  }).some((worktree) => worktree.path === inside),
  true,
)

const heldLines = []
sweepPull({
  root: primary,
  branch: "held",
  number: 9,
  head: git(primary, "rev-parse", "HEAD").trim(),
  here: primary,
  base: "main",
  scratchRoot,
  say: (line) => heldLines.push(line),
})
same(
  "the main checkout stays even when it is on the pull request branch and land is running there",
  fs.existsSync(primary),
  true,
)
same("and the line names the main checkout", heldLines, [
  `left worktree ${primary}, because it is the main checkout. Remove it with: git -C ${primary} checkout --detach && git -C ${primary} branch -D held`,
])
same("its branch stays", git(primary, "branch", "--format=%(refname:short)").includes("held"), true)

const featureHead = git(feature, "rev-parse", "HEAD").trim()
const featureLines = run("feature", { head: featureHead, busy: (where) => where === tipScratch })
same("the pull request worktree is removed", fs.existsSync(feature), false)
same("a scratch tree of its own commit is removed", fs.existsSync(midScratch), false)
same("a scratch tree a process is using stays", fs.existsSync(tipScratch), true)
same("a scratch tree of main stays", fs.existsSync(sharedScratch), true)
same("another pull request's scratch tree stays", fs.existsSync(otherScratch), true)
same("another pull request's worktree stays", fs.existsSync(other), true)
same("a fresh worktree with no work of its own stays", fs.existsSync(fresh), true)
same("the lines name this pull request and not the idle rule", featureLines, [
  `removed worktree ${feature}, because its pull request 12 is merged`,
  `removed worktree ${midScratch}, because it is a verify-airdesign scratch tree of pull request 12`,
  `left worktree ${tipScratch}, because a process is using it. Remove it with: git -C ${root} worktree remove ${tipScratch}`,
  "deleted branch feature, because its pull request 12 is merged",
])
same("the pull request branch is deleted", branches().includes("feature"), false)
same("the fresh branch stays", branches().includes("fresh"), true)
same(
  "no line tells git to force a removal",
  featureLines.some((line) => line.includes("--force")),
  false,
)

const aheadLines = run("ahead", { head: aheadLanded, number: 15 })
const aheadTip = git(ahead, "rev-parse", "HEAD").trim()
same("a worktree with a commit after the merged head stays", fs.existsSync(ahead), true)
same("and one line says it has unpushed commits", aheadLines, [
  `left worktree ${ahead}, because it has unpushed commits. Remove it with: git -C ${root} worktree remove ${ahead} && git -C ${root} branch -D ahead`,
])
same("its branch stays", branches().includes("ahead"), true)
same("the unpushed commit stays on that branch", git(root, "branch", "--contains", aheadTip).includes("ahead"), true)

const orphanLines = run("orphan", { head: orphanLanded, number: 16 })
same("a branch with a commit after the merged head stays", branches().includes("orphan"), true)
same("and one line says how to delete it", orphanLines, [
  `left branch orphan, because it has unpushed commits. Remove it with: git -C ${root} branch -D orphan`,
])
same(
  "the unpushed branch tip stays reachable",
  git(root, "merge-base", "--is-ancestor", orphanLanded, "refs/heads/orphan").trim(),
  "",
)

const olderLines = run("older", { head: olderMerged })
same("a worktree whose tip is an ancestor of the merged head is removed", fs.existsSync(older), false)
same("and its branch is deleted", branches().includes("older"), false)
same("the lines name that ancestor removal", olderLines, [
  `removed worktree ${older}, because its pull request 12 is merged`,
  "deleted branch older, because its pull request 12 is merged",
])

const lockedLines = run("locked", { head: lockedHead, number: 17 })
same("a locked worktree stays", fs.existsSync(lockedTree), true)
same("and one line says it is locked", lockedLines, [
  `left worktree ${lockedTree}, because it is locked. Remove it with: git -C ${root} worktree remove ${lockedTree} && git -C ${root} branch -D locked`,
])
same("its branch stays", branches().includes("locked"), true)

const unnamed = add("unnamed")
const unnamedLines = run("unnamed")
same("a sweep without the merged head leaves the worktree", fs.existsSync(unnamed), true)
same("and prints the command instead of deleting it", unnamedLines, [
  `left worktree ${unnamed}, because it has unpushed commits. Remove it with: git -C ${root} worktree remove ${unnamed} && git -C ${root} branch -D unnamed`,
])

const missingBase = []
sweepPull({
  root,
  branch: "based",
  number: 7,
  head: basedHead,
  here: root,
  base: "origin/does-not-exist",
  scratchRoot,
  say: (line) => missingBase.push(line),
})
same(
  "a missing base removes no scratch trees",
  [fs.existsSync(basedScratch), fs.existsSync(strayScratch)],
  [true, true],
)
same("and still removes the worktree whose tip is the merged head", missingBase, [
  `removed worktree ${based}, because its pull request 7 is merged`,
  "deleted branch based, because its pull request 7 is merged",
])
same("that branch is gone", branches().includes("based"), false)

const ownLines = []
sweepPull({
  root: own,
  branch: "own",
  number: 3,
  head: ownHead,
  here: root,
  base: "main",
  scratchRoot,
  say: (line) => ownLines.push(line),
})
same("removing the worktree land was given still deletes it from the main checkout", fs.existsSync(own), false)
same("and deletes the branch from that same checkout", branches().includes("own"), false)
same("both lines are printed", ownLines, [
  `removed worktree ${own}, because its pull request 3 is merged`,
  "deleted branch own, because its pull request 3 is merged",
])

const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-outside-"))
process.on("exit", () => fs.rmSync(outside, { recursive: true, force: true }))
const outsideRemote = path.join(outside, "remote.git")
const checkout = path.join(outside, "repo")
const elsewhere = path.join(outside, "elsewhere")
fs.mkdirSync(checkout)
git(outside, "init", "-q", "--bare", outsideRemote)
git(checkout, "init", "-q", "-b", "main")
commit(checkout, "a.txt", "a")
git(checkout, "remote", "add", "origin", outsideRemote)
git(checkout, "push", "-q", "-u", "origin", "main")
const place = (name) => path.join(elsewhere, name)
const pushedTree = place("t3/pushed")
const unpushedTree = place("t3/unpushed")
const recentTree = place("t3/recent")
const lockedOutside = place("t3/locked")
const verifyTree = place("AirDesign-verify-clean")
const dirtyTree = place("AirDesign-verify-dirty")
const busyTree = place("AirDesign-verify-busy")
git(checkout, "worktree", "add", "-q", "-b", "pushed", pushedTree, "main")
git(checkout, "worktree", "add", "-q", "-b", "unpushed", unpushedTree, "main")
git(checkout, "worktree", "add", "-q", "-b", "recent", recentTree, "main")
git(checkout, "worktree", "add", "-q", "-b", "locked-outside", lockedOutside, "main")
git(checkout, "worktree", "add", "-q", "--detach", verifyTree, "main")
git(checkout, "worktree", "add", "-q", "--detach", dirtyTree, "main")
git(checkout, "worktree", "add", "-q", "--detach", busyTree, "main")
const pushedHead = commit(pushedTree, "pushed.txt", "pushed")
git(pushedTree, "push", "-q", "-u", "origin", "pushed")
const unpushedHead = commit(unpushedTree, "unpushed.txt", "unpushed")
commit(recentTree, "recent.txt", "recent")
git(recentTree, "push", "-q", "-u", "origin", "recent")
git(checkout, "worktree", "lock", lockedOutside)
fs.writeFileSync(path.join(dirtyTree, "unsaved.txt"), "unsaved")
const age = (worktree) => {
  const raw = fs.readFileSync(path.join(worktree, ".git"), "utf8").replace("gitdir:", "").trim()
  const gitdir = path.isAbsolute(raw) ? raw : path.resolve(worktree, raw)
  const when = new Date(Date.now() - recentFor - 60_000)
  for (const name of ["HEAD", "index"]) fs.utimesSync(path.join(gitdir, name), when, when)
}
for (const worktree of [pushedTree, unpushedTree, lockedOutside, verifyTree, dirtyTree, busyTree]) age(worktree)
const home = path.join(outside, "home")
fs.mkdirSync(home)
const quiet = { pulls: new Map(), home, busy: (where) => where === busyTree, now: Date.now() }
const named = (lines) => lines.filter((line) => line.startsWith("would remove worktree ")).sort()
const dryLines = []
sweep({ root: checkout, apply: false, say: (line) => dryLines.push(line), ...quiet })
same("the outside worktrees are not inside the checkout", path.relative(checkout, pushedTree).startsWith(".."), true)
same(
  "a dry run names a pushed worktree and a detached verify checkout outside the repo",
  named(dryLines),
  [
    `would remove worktree ${pushedTree}, because its commit is on a remote branch`,
    `would remove worktree ${verifyTree}, because its commit is on a remote branch`,
  ].sort(),
)
same(
  "a dry run leaves the checkout, a dirty tree, an unpushed tree, a busy tree, a locked tree and a recent tree",
  [checkout, dirtyTree, unpushedTree, busyTree, lockedOutside, recentTree].every((where) => fs.existsSync(where)),
  true,
)
same(
  "none of those kept trees are named",
  dryLines.some((line) =>
    [checkout, dirtyTree, unpushedTree, busyTree, lockedOutside, recentTree].some((where) => line.includes(where)),
  ),
  false,
)
const applied = []
sweep({ root: checkout, apply: true, say: (line) => applied.push(line), ...quiet })
same(
  "apply removes the pushed worktree and the detached verify checkout",
  applied.sort(),
  [
    `removed worktree ${pushedTree}, because its commit is on a remote branch`,
    `removed worktree ${verifyTree}, because its commit is on a remote branch`,
  ].sort(),
)
same(
  "the removed folders are gone and the kept ones stay",
  [pushedTree, verifyTree, checkout, dirtyTree, unpushedTree, busyTree, lockedOutside, recentTree].map((where) =>
    fs.existsSync(where),
  ),
  [false, false, true, true, true, true, true, true],
)
same("the pushed branch stays", git(checkout, "rev-parse", "--verify", "refs/heads/pushed").trim(), pushedHead)
same("the unpushed commit stays on its branch", git(checkout, "rev-parse", "unpushed").trim(), unpushedHead)

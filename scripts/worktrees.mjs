import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const hours = 60 * 60 * 1000

export const idleBefore = 12 * hours

const git = (cwd, args) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return undefined
  }
}

export const readWorktrees = (text) =>
  text
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      const lines = block.split("\n")
      const field = (name) => lines.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1)
      return {
        path: field("worktree"),
        head: field("HEAD"),
        branch: field("branch"),
        locked: lines.some((line) => line === "locked" || line.startsWith("locked ")),
      }
    })

const ownCommits = (root, tip, base) => {
  const listed = git(root, ["cherry", base, tip])
  if (listed === undefined) return undefined
  const lines = listed.split("\n").filter((line) => line.length > 0)
  return { total: lines.length, unlanded: lines.filter((line) => line.startsWith("+")).length }
}

const upstreamGone = (root, branch) =>
  branch !== undefined && git(root, ["for-each-ref", "--format=%(upstream:track)", branch])?.trim() === "[gone]"

const lastTouched = (worktree) => {
  const pointer = path.join(worktree, ".git")
  try {
    const gitdir = fs.readFileSync(pointer, "utf8").replace("gitdir:", "").trim()
    return Math.max(
      ...["index", "HEAD"].map((name) => {
        try {
          return fs.statSync(path.join(gitdir, name)).mtimeMs
        } catch {
          return 0
        }
      }),
    )
  } catch {
    return 0
  }
}

const usedByAProcess = (worktree) => {
  let entries
  try {
    entries = fs.readdirSync("/proc")
  } catch {
    return false
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    let cwd
    try {
      cwd = fs.readlinkSync(`/proc/${entry}/cwd`)
    } catch {
      continue
    }
    if (cwd === worktree || cwd.startsWith(`${worktree}/`)) return true
  }
  return false
}

const clean = (worktree) => git(worktree, ["status", "--porcelain"]) === ""

export const staleReason = ({ commits, gone, idle, detached }) => {
  if (detached && !idle) return undefined
  if (commits !== undefined && commits.total > 0 && commits.unlanded === 0) return "its work is on main"
  if (gone) return "its branch is gone from GitHub"
  if (commits !== undefined && commits.total === 0 && idle) return "it has no work of its own and sat idle"
  return undefined
}

export const findStale = ({ root, base = "origin/main", now = Date.now(), busy = usedByAProcess }) => {
  const listed = git(root, ["worktree", "list", "--porcelain"])
  if (listed === undefined) return []
  const [, ...others] = readWorktrees(listed)
  const stale = []
  for (const worktree of others) {
    if (worktree.locked || worktree.path === undefined || worktree.head === undefined) continue
    const commits = ownCommits(root, worktree.head, base)
    const reason = staleReason({
      commits,
      gone: upstreamGone(root, worktree.branch),
      idle: now - lastTouched(worktree.path) > idleBefore,
      detached: worktree.branch === undefined,
    })
    if (reason === undefined) continue
    if (busy(worktree.path) || !clean(worktree.path)) continue
    stale.push({ ...worktree, reason, landed: commits !== undefined && commits.unlanded === 0 })
  }
  return stale
}

export const removeStale = ({ root, say = console.log, ...options }) => {
  const removed = []
  for (const worktree of findStale({ root, ...options })) {
    if (git(root, ["worktree", "remove", worktree.path]) === undefined) continue
    if (worktree.branch !== undefined && worktree.landed)
      git(root, ["branch", "-D", worktree.branch.replace("refs/heads/", "")])
    say(`removed worktree ${worktree.path}, because ${worktree.reason}`)
    removed.push(worktree.path)
  }
  return removed
}

export const staleBranches = ({ root, base = "origin/main" }) => {
  const listed = git(root, ["worktree", "list", "--porcelain"])
  const named = git(root, ["for-each-ref", "--format=%(refname)", "refs/heads"])
  if (listed === undefined || named === undefined) return []
  const held = new Set(readWorktrees(listed).map((worktree) => worktree.branch))
  return named
    .split("\n")
    .filter((branch) => branch.length > 0 && branch !== "refs/heads/main" && !held.has(branch))
    .filter((branch) => ownCommits(root, branch, base)?.unlanded === 0)
    .map((branch) => branch.replace("refs/heads/", ""))
    .sort()
}

export const removeStaleBranches = ({ root, say = console.log, ...options }) => {
  const removed = []
  for (const branch of staleBranches({ root, ...options })) {
    if (git(root, ["branch", "-D", branch]) === undefined) continue
    say(`deleted branch ${branch}, because it holds nothing main lacks`)
    removed.push(branch)
  }
  return removed
}

export const bringMainUp = ({ root, base = "origin/main" }) => {
  const listed = git(root, ["worktree", "list", "--porcelain"])
  if (listed === undefined) return false
  const [first] = readWorktrees(listed)
  if (first?.path === undefined || first.branch !== "refs/heads/main" || !clean(first.path)) return false
  const before = git(first.path, ["rev-parse", "HEAD"])
  if (git(first.path, ["merge", "--ff-only", "--quiet", base]) === undefined) return false
  return git(first.path, ["rev-parse", "HEAD"]) !== before
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const onCi = process.env.CI === "true" || process.env.CI === "1"
  if (!onCi) {
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
    removeStale({ root })
    removeStaleBranches({ root })
    if (bringMainUp({ root })) console.log("brought the main checkout up to origin/main")
  }
}

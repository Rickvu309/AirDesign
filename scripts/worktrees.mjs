import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { deployBranch } from "./deploy-commit.mjs"

const hours = 60 * 60 * 1000

export const idleBefore = 12 * hours
export const recentFor = 3 * hours
export const verifyScratch = path.join(os.homedir(), "tmp", "verify-airdesign-scratch")

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

export const warnStashes = ({ root, say = console.warn }) => {
  const listed = git(root, ["stash", "list", "--format=%gd%x00%H%x00%gs"])
  const worktrees = git(root, ["worktree", "list", "--porcelain"])
  if (listed === undefined || worktrees === undefined) return []
  const held = new Set(
    readWorktrees(worktrees)
      .filter((worktree) => worktree.path !== undefined && fs.existsSync(worktree.path))
      .map((worktree) => worktree.branch?.replace("refs/heads/", "")),
  )
  const warnings = []
  for (const line of listed.split("\n").filter(Boolean)) {
    const [entry, hash, subject] = line.split("\0")
    const source = /^(?:On |WIP on )(.+?): (.*)$/.exec(subject ?? "")
    if (source === null) continue
    const [, branch, note] = source
    const named =
      /^leftover from (.+) \([^)]+\), saved /.exec(note)?.[1] ??
      (note.startsWith("worktree: ") ? note.slice("worktree: ".length) : note)
    const sourcePath = path.isAbsolute(named) ? named : undefined
    const reason =
      sourcePath !== undefined && !fs.existsSync(sourcePath)
        ? `worktree ${sourcePath}, which is gone`
        : branch !== "(no branch)" && !held.has(branch)
          ? `branch ${branch}, which has no worktree`
          : undefined
    if (reason === undefined) continue
    const warning = `${entry} was saved from ${reason}. The stash is shared. Inspect it with git stash show -p ${hash}; recover it on its branch only if it is yours. Leave other people's entries alone.`
    say(warning)
    warnings.push(warning)
  }
  return warnings
}

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

export const usedByAProcess = (worktree) => {
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

const pullReason = (pull) => `its pull request ${pull.number} is ${pull.state.toLowerCase()}`

export const readPulls = (root) => {
  try {
    const listed = execFileSync(
      "gh",
      ["pr", "list", "--state", "all", "--limit", "5000", "--json", "number,state,headRefOid"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 },
    )
    return new Map(
      JSON.parse(listed)
        .filter((pull) => pull.state !== "OPEN")
        .map((pull) => [pull.headRefOid, { number: pull.number, state: pull.state }]),
    )
  } catch {
    return new Map()
  }
}

export const staleReason = ({ commits, gone, idle, detached, recent, pull, scratch }) => {
  if (recent) return undefined
  if (pull !== undefined) return pullReason(pull)
  if (scratch) return "it is a verify-airdesign scratch tree"
  if (detached && !idle) return undefined
  if (commits !== undefined && commits.total > 0 && commits.unlanded === 0) return "its work is on main"
  if (gone) return "its branch is gone from GitHub"
  if (commits !== undefined && commits.total === 0 && idle) return "it has no work of its own and sat idle"
  return undefined
}

export const findStale = ({
  root,
  base = "origin/main",
  now = Date.now(),
  busy = usedByAProcess,
  pulls = new Map(),
  scratchRoot = verifyScratch,
}) => {
  const listed = git(root, ["worktree", "list", "--porcelain"])
  if (listed === undefined) return []
  const [, ...others] = readWorktrees(listed)
  const stale = []
  for (const worktree of others) {
    if (worktree.locked || worktree.path === undefined || worktree.head === undefined) continue
    const commits = ownCommits(root, worktree.head, base)
    const touched = now - lastTouched(worktree.path)
    const detached = worktree.branch === undefined
    const pull = detached ? undefined : pulls.get(worktree.head)
    const reason = staleReason({
      commits,
      gone: upstreamGone(root, worktree.branch),
      idle: touched > idleBefore,
      recent: touched < recentFor,
      detached,
      pull,
      scratch: detached && path.dirname(worktree.path) === scratchRoot,
    })
    if (reason === undefined) continue
    if (busy(worktree.path) || !clean(worktree.path)) continue
    stale.push({ ...worktree, reason, landed: pull !== undefined || (commits !== undefined && commits.unlanded === 0) })
  }
  return stale
}

export const removeStale = ({ root, say = console.log, apply = true, ...options }) => {
  const removed = []
  for (const worktree of findStale({ root, ...options })) {
    if (!apply) {
      say(`would remove worktree ${worktree.path}, because ${worktree.reason}`)
      continue
    }
    if (git(root, ["worktree", "remove", worktree.path]) === undefined) continue
    if (worktree.branch !== undefined && worktree.landed)
      git(root, ["branch", "-D", worktree.branch.replace("refs/heads/", "")])
    say(`removed worktree ${worktree.path}, because ${worktree.reason}`)
    removed.push(worktree.path)
  }
  return removed
}

const branchReason = (root, branch, base, pulls) => {
  const tip = git(root, ["rev-parse", branch])?.trim()
  const pull = tip === undefined ? undefined : pulls.get(tip)
  if (pull !== undefined) return pullReason(pull)
  return ownCommits(root, branch, base)?.unlanded === 0 ? "it holds nothing main lacks" : undefined
}

export const staleBranches = ({ root, base = "origin/main", pulls = new Map() }) =>
  staleBranchReasons({ root, base, pulls }).map(({ branch }) => branch)

const staleBranchReasons = ({ root, base = "origin/main", pulls = new Map() }) => {
  const listed = git(root, ["worktree", "list", "--porcelain"])
  const named = git(root, ["for-each-ref", "--format=%(refname)", "refs/heads"])
  if (listed === undefined || named === undefined) return []
  const held = new Set(readWorktrees(listed).map((worktree) => worktree.branch))
  const kept = new Set(["refs/heads/main", `refs/heads/${deployBranch}`])
  return named
    .split("\n")
    .filter((branch) => branch.length > 0 && !kept.has(branch) && !held.has(branch))
    .map((branch) => ({ branch: branch.replace("refs/heads/", ""), reason: branchReason(root, branch, base, pulls) }))
    .filter(({ reason }) => reason !== undefined)
    .sort((left, right) => left.branch.localeCompare(right.branch))
}

export const removeStaleBranches = ({ root, say = console.log, apply = true, ...options }) => {
  const removed = []
  for (const { branch, reason } of staleBranchReasons({ root, ...options })) {
    if (!apply) {
      say(`would delete branch ${branch}, because ${reason}`)
      continue
    }
    if (git(root, ["branch", "-D", branch]) === undefined) continue
    say(`deleted branch ${branch}, because ${reason}`)
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
    warnStashes({ root })
    if (bringMainUp({ root })) console.log("brought the main checkout up to origin/main")
  }
}

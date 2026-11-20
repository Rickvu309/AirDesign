import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { failedCauses, failedSteps, failedTests } from "./failed-tests.mjs"
import { runner, succeeds } from "./land-git.mjs"
import { mainWhenRunStarted } from "./land-report.mjs"
import { readPull } from "./merge-queue.mjs"

const short = (sha) => sha.slice(0, 8)
const listed = 8
const gateNotes = /^(?:gate|affected report): /
const pathPattern = /(?:[\w@.-]+\/)*[\w@-]+\.(?:tsx?|mts|mjs|cjs|jsx?|json|css|md|ya?ml|sql|astro)\b/g

const newestRunOn = ({ gh, repository, head }) => {
  const answer = gh([
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${head}&event=pull_request&per_page=1`,
    "--jq",
    "[.workflow_runs[] | {id, event, branch: .head_branch, head: .head_sha, createdAt: .created_at}]",
  ])
  return answer.status === 0 ? JSON.parse(answer.stdout || "[]")[0] : undefined
}

const testedBase = ({ gh, git, repository, head, main }) => {
  const run = newestRunOn({ gh, repository, head })
  const fromRun = run === undefined ? undefined : mainWhenRunStarted({ repository, run, gh, git })
  if (fromRun !== undefined) return { sha: fromRun, how: `ci run ${run.id}` }
  const shared = succeeds(git(["merge-base", head, main]), `could not find where ${short(head)} left main`).trim()
  return { sha: shared, how: "where the branch left main; no ci run on this head was found" }
}

const commitsBetween = (git, from, to) =>
  succeeds(git(["log", "--format=%x01%H%x00%s", "--name-only", `${from}..${to}`]), `could not list ${from}..${to}`)
    .split("\u0001")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const [first, ...files] = block.split("\n")
      const [sha, subject] = first.split("\u0000")
      return { sha, subject, files: files.filter((file) => file !== "") }
    })

const touches = (commit, paths) =>
  commit.files.some((file) => paths.some((named) => file === named || file.endsWith(`/${named}`)))

const commitLine = ({ sha, subject }) => `  ${short(sha)} ${subject}`

const firstOf = (commits) => [
  ...commits.slice(0, listed).map(commitLine),
  ...(commits.length > listed ? [`  and ${commits.length - listed} more`] : []),
]

const clashLines = (moved, paths) => {
  const named = moved.filter((commit) => touches(commit, paths))
  return named.length > 0
    ? ["It clashes with these commits main gained:", ...firstOf(named)]
    : ["No commit main gained touches a file the failure names. These are the commits main gained:", ...firstOf(moved)]
}

const failureLines = (output) => {
  const tests = failedTests(output).map((test) => `  ${test.file}: ${test.name}${test.error ? ` (${test.error})` : ""}`)
  const causes = failedCauses(output).flatMap((cause) =>
    cause.lines.filter((each) => !gateNotes.test(each)).map((each) => `  ${cause.step}: ${each}`),
  )
  return [...tests, ...causes]
}

const counted = (count) => `${count} ${count === 1 ? "commit" : "commits"}`

const rebaseAdvice =
  "Nothing merged. Rebase onto the newest main, fix the clash, and land again: git fetch origin main && git rebase origin/main && pnpm land"

export const premergeRecheck = async ({ git, gh, repository, head, gate, now = Date.now }) => {
  succeeds(git(["fetch", "origin", "main"]), "could not fetch origin/main")
  const main = succeeds(git(["rev-parse", "--verify", "origin/main^{commit}"]), "could not read origin/main").trim()
  const tested = testedBase({ gh, git, repository, head, main })
  const moved = commitsBetween(git, tested.sha, main)
  const since = `ci tested ${short(head)} on main ${short(tested.sha)} (${tested.how})`
  if (moved.length === 0)
    return { ok: true, main, lines: [`${since}, and main has not moved past it; nothing to recheck`] }
  const gained = `${since}; main has gained ${counted(moved.length)} since`
  const merged = git(["merge-tree", "--write-tree", "--name-only", main, head])
  if (merged.status === 1) {
    const [, ...rest] = merged.stdout.split("\n")
    const files = rest.slice(0, rest.indexOf("")).filter((file) => file !== "")
    return {
      ok: false,
      main,
      lines: [
        `${short(head)} conflicts with origin/main ${short(main)} in ${files.join(", ")}. ${gained}.`,
        ...clashLines(moved, files),
        rebaseAdvice,
      ],
    }
  }
  const tree = succeeds(merged, `could not merge ${short(head)} with ${short(main)}`)
    .split("\n")[0]
    .trim()
  const commit = succeeds(
    git(["commit-tree", tree, "-p", main, "-m", `Recheck ${head} on ${main}`]),
    "could not write the merged commit",
  ).trim()
  const started = now()
  const ran = await gate({ commit, main })
  const seconds = `${Math.round((now() - started) / 1000)} s`
  const where = `${short(head)} merged with origin/main ${short(main)}`
  if (ran.status === 0) return { ok: true, main, lines: [`${where} passes pnpm gate in ${seconds}. ${gained}.`] }
  const steps = failedSteps(ran.output)
  const failure = failureLines(ran.output)
  const paths = [...new Set(failure.join("\n").match(pathPattern) ?? [])]
  return {
    ok: false,
    main,
    lines: [
      `${where} fails ${steps.length > 0 ? steps.join(", ") : "pnpm gate"} in ${seconds}. ${gained}.`,
      ...failure,
      ...clashLines(moved, paths),
      ...(ran.log === undefined ? [] : [`The whole gate output is in ${ran.log}`]),
      rebaseAdvice,
    ],
  }
}

export const scratchGate =
  ({ git, folder = path.join(os.homedir(), "tmp", "recheck") }) =>
  async ({ commit, main }) => {
    fs.mkdirSync(folder, { recursive: true })
    const dir = path.join(folder, commit.slice(0, 12))
    const log = `${dir}.log`
    git(["worktree", "remove", "--force", dir])
    succeeds(git(["worktree", "add", "--detach", "--quiet", dir, commit]), "could not add the recheck worktree")
    const remove = () => git(["worktree", "remove", "--force", dir])
    const onSignal = (signal) => {
      remove()
      process.kill(process.pid, signal)
    }
    process.once("SIGINT", onSignal)
    process.once("SIGTERM", onSignal)
    const out = fs.openSync(log, "w")
    const step = (command, args) =>
      new Promise((resolve) => {
        const child = spawn(command, args, { cwd: dir, stdio: ["ignore", out, out] })
        child.on("error", () => resolve(1))
        child.on("close", (status) => resolve(status ?? 1))
      })
    try {
      const installed = await step("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"])
      const status =
        installed === 0 ? await step(process.execPath, ["scripts/gate.mjs", "--base", main, "--all"]) : installed
      return { status, output: fs.readFileSync(log, "utf8"), log }
    } finally {
      fs.closeSync(out)
      process.off("SIGINT", onSignal)
      process.off("SIGTERM", onSignal)
      remove()
    }
  }

export const mergeArgs = (number, head) => ["pr", "merge", String(number), "--rebase", "--match-head-commit", head]

export const mergeAfterRecheck =
  ({ recheck, gh, read, repository, number, say }) =>
  async (pull) => {
    say(`recheck: ci passed on ${short(pull.head)}; checking it against the newest main before the merge`)
    const checked = await recheck({ number, head: pull.head })
    for (const each of checked.lines) say(`recheck: ${each}`)
    if (!checked.ok) return 1
    const asked = gh(mergeArgs(number, pull.head))
    const after = readPull({ read, repository, number })
    if (after.merged) {
      say(`follow: merged ${short(pull.head)}, the head the recheck tested. pull request ${number} is on main.`)
      return 0
    }
    say(
      `follow: pull request ${number} did not merge: ${`${asked.stdout}${asked.stderr}`.trim() || "gh said nothing"}. If its head moved, run pnpm land again.`,
    )
    return 1
  }

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const [head] = process.argv.slice(2)
  if (head === undefined) {
    console.error("usage: node scripts/premerge-recheck.mjs <head>")
    process.exit(1)
  }
  const git = runner("git", root)
  const gh = runner("gh", root)
  const repository = succeeds(
    gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]),
    "could not name the repository",
  ).trim()
  const sha = succeeds(git(["rev-parse", "--verify", `${head}^{commit}`]), `could not read ${head}`).trim()
  const checked = await premergeRecheck({ git, gh, repository, head: sha, gate: scratchGate({ git }) })
  for (const each of checked.lines) console.log(each)
  process.exit(checked.ok ? 0 : 1)
}

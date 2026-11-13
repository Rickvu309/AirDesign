import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { stages } from "./check.mjs"
import { stampChecked } from "./checked.mjs"
import { filesWithMarkers, markerFault } from "./conflict-markers.mjs"
import { readWithRetry } from "./github-read.mjs"
import { judgeCheck } from "./land-check.mjs"
import { followPull } from "./land-follow.mjs"
import { behindMain, conflictsWithMain, currentBranch, dirtyFiles, runner, succeeds } from "./land-git.mjs"
import { statusLines } from "./land-status.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { awaitChecks, enqueue, queueLine, readPull } from "./merge-queue.mjs"
import { migrationFault, recordFile } from "./migration-numbers.mjs"
import { baseFault } from "./pull-base.mjs"

const valueFlags = ["--pr", "--title", "--body-file"]
const switchFlags = ["--status", "--watch", "--check", "--no-follow", "--help", "-h"]

export const usage = [
  "usage: pnpm land [--title <text> --body-file <path>] [--no-follow] [--check]",
  "       pnpm land --watch [--pr <number>]",
  "       pnpm land --status [--pr <number>]",
  "       pnpm land --help",
]

const unknownIn = (argv) => {
  const unknown = []
  for (let at = 0; at < argv.length; at += 1) {
    if (valueFlags.includes(argv[at])) at += 1
    else if (!switchFlags.includes(argv[at])) unknown.push(argv[at])
  }
  return unknown
}

const flagValue = (argv, name) => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}

export const parseArgs = (argv) => ({
  help: argv.includes("--help") || argv.includes("-h"),
  unknown: unknownIn(argv),
  status: argv.includes("--status"),
  watch: argv.includes("--watch"),
  checkOnly: argv.includes("--check"),
  follow: !argv.includes("--no-follow"),
  pr: flagValue(argv, "--pr") === undefined ? undefined : Number(flagValue(argv, "--pr")),
  title: flagValue(argv, "--title"),
  bodyFile: flagValue(argv, "--body-file"),
})

const jsonAt = (git, revision) => {
  const shown = git(["show", `${revision}:${recordFile}`])
  return shown.status === 0 ? JSON.parse(shown.stdout) : undefined
}

const findPull = ({ gh, branch, number }) => {
  const found =
    number === undefined
      ? gh(["pr", "list", "--head", branch, "--state", "open", "--json", "number,baseRefName,url", "--limit", "1"])
      : gh(["pr", "view", String(number), "--json", "number,baseRefName,url"])
  const parsed = JSON.parse(succeeds(found, "could not read the pull request"))
  return number === undefined ? parsed[0] : parsed
}

class Stop extends Error {}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const land = async (ctx) => {
  const { args, git, gh, say, sleep = pause, now = () => Date.now() } = ctx
  if (args.help) {
    for (const each of usage) say(each)
    return 0
  }
  if (args.unknown.length > 0) {
    say(`STOPPED: ${args.unknown.join(", ")} ${args.unknown.length === 1 ? "is" : "are"} not a flag of pnpm land.`)
    for (const each of usage) say(each)
    return 1
  }
  const line = (step, text) => say(`${step.padEnd(11)}${text}`)
  const stop = (step, why) => {
    throw new Stop(`STOPPED at ${step}: ${why}`)
  }
  const read = ctx.read ?? readWithRetry({ run: (command) => succeeds(gh(command), `gh ${command[0]}`), say })
  const repository =
    ctx.repository ??
    succeeds(
      gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]),
      "could not name the repository",
    ).trim()
  const follow = (number, branch) =>
    followPull({
      number,
      branch,
      repository,
      read,
      gh,
      git,
      sleep,
      now,
      say,
      interval: ctx.interval,
      graceMs: ctx.graceMs,
      limitMs: ctx.limitMs,
    })
  try {
    const branch = args.pr === undefined || !(args.status || args.watch) ? currentBranch(git) : "(by number)"
    succeeds(git(["fetch", "origin", "main"]), "could not fetch origin/main")
    if (args.status || args.watch) {
      const pull = findPull({ gh, branch, number: args.pr })
      if (pull === undefined)
        stop("pull request", `${branch} has no open pull request. Push it and open one: gh pr create --base main`)
      const state = readPull({ read, repository, number: pull.number })
      if (args.status) {
        succeeds(
          git(["fetch", "origin", `pull/${pull.number}/head`]),
          `could not fetch the head of pull request ${pull.number}`,
        )
        const ref = "FETCH_HEAD"
        for (const each of statusLines({ number: pull.number, branch, repository, pull: state, git, gh, ref }))
          line("status", each)
        return 0
      }
      return await follow(pull.number, branch)
    }
    if (branch === "main" || branch === "HEAD")
      stop("branch", `you are on ${branch}. Land from the branch of your pull request.`)
    line("branch", `${branch}`)
    const dirty = dirtyFiles(git)
    if (dirty.length > 0)
      stop(
        "working tree",
        `${dirty.length} files are not committed (${dirty.slice(0, 5).join(", ")}). Commit them, so the check judges what you push.`,
      )
    git(["fetch", "origin", branch])
    let pull = findPull({ gh, branch })
    if (pull !== undefined) {
      const wrong = baseFault(pull.number, pull.baseRefName)
      if (wrong !== undefined) stop("base", wrong)
      line("base", `pull request ${pull.number} targets main`)
    } else line("base", "no pull request yet; it will open against main")
    const conflicts = conflictsWithMain(git)
    if (conflicts.length > 0) {
      stop(
        "conflicts",
        `this branch conflicts with origin/main in ${conflicts.join(", ")}. Rebase now, before the check: git rebase origin/main, resolve, then run pnpm land again.`,
      )
    }
    line("conflicts", `none; ${behindMain(git)} commits behind origin/main`)
    const numbers = migrationFault({ base: jsonAt(git, "origin/main"), head: jsonAt(git, "HEAD") })
    if (numbers !== undefined) stop("migrations", numbers)
    line("migrations", "no migration number is taken on origin/main")
    const early = markerFault(filesWithMarkers(git))
    if (early !== undefined) stop("markers", early)
    line("markers", "no conflict marker in the commit")
    line("check", "running pnpm check. If another check holds this machine, its line below says so and this one waits.")
    const verdict = await judgeCheck({ ...(await ctx.check()), rerun: ctx.rerun, say: (text) => line("check", text) })
    if (!verdict.passed) stop("check", verdict.how)
    ctx.stamp()
    line("check", `${verdict.how}; the commit is stamped for the push guard`)
    if (args.checkOnly) return 0
    const late = markerFault(filesWithMarkers(git))
    if (late !== undefined) stop("markers", late)
    const pushed = git(["push", "--force-with-lease", "--set-upstream", "origin", branch])
    if (pushed.status !== 0) stop("push", `git push refused: ${(pushed.stderr || pushed.stdout).trim()}`)
    line("push", `${branch} pushed with a lease`)
    if (pull === undefined) {
      if (args.title === undefined || args.bodyFile === undefined) {
        stop(
          "pull request",
          `${branch} has no pull request. Open it against main: gh pr create --base main --title "..." --body-file body.md, then run pnpm land --watch. Or run pnpm land again with --title and --body-file.`,
        )
      }
      succeeds(
        gh(["pr", "create", "--base", "main", "--head", branch, "--title", args.title, "--body-file", args.bodyFile]),
        "could not open the pull request",
      )
      pull = findPull({ gh, branch })
      if (pull === undefined) stop("pull request", "gh opened a pull request but could not read it back")
    }
    const wrong = baseFault(pull.number, pull.baseRefName)
    if (wrong !== undefined) stop("base", wrong)
    line("opened", `pull request ${pull.number}: ${pull.url}`)
    const ready = await awaitChecks({
      read,
      repository,
      number: pull.number,
      sleep,
      now,
      say: (text) => line("queue", text),
      intervalMs: ctx.checksIntervalMs,
      limitMs: ctx.checksLimitMs,
    })
    if (!ready.ok) stop("queue", ready.message)
    const queued = enqueue({ merge: gh, read, repository, number: pull.number })
    if (!queued.ok) stop("queue", queued.message)
    line("queue", queueLine(queued.state))
    return args.follow ? await follow(pull.number, branch) : 0
  } catch (error) {
    if (error instanceof Stop) {
      say(error.message)
      return 1
    }
    say(`STOPPED: ${error.message}`)
    return 1
  }
}

const tee = (command, argv, env, cwd) =>
  new Promise((resolve) => {
    const child = spawn(command, argv, { cwd, env })
    let output = ""
    const take = (stream, sink) =>
      stream.on("data", (chunk) => {
        output += chunk
        sink.write(chunk)
      })
    take(child.stdout, process.stdout)
    take(child.stderr, process.stderr)
    child.on("error", (error) => resolve({ status: 1, output: `${output}${error.message}\n` }))
    child.on("close", (status) => resolve({ status: status ?? 1, output }))
  })

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const say = (text) => console.log(text)
  const testStep = stages.flat().find(([name]) => name === "test")
  const code = await land({
    args: parseArgs(process.argv.slice(2)),
    git: runner("git", root),
    gh: runner("gh", root),
    check: () => tee("pnpm", ["check"], process.env, root),
    rerun: async (file) => {
      const release = await takeMachineLock({ say: console.error })
      try {
        return await tee(testStep[1], [...testStep[2], file], { ...process.env, ...testStep[3] }, root)
      } finally {
        await release()
      }
    },
    stamp: () => stampChecked(root),
    say,
  })
  process.exit(code)
}

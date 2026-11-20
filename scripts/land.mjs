import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { checkSteps } from "./check-steps.mjs"
import { stampChecked, workingTree } from "./checked.mjs"
import { readLocal, verdict } from "./bar.mjs"
import { attributionLine } from "./commit-authors.mjs"
import { filesWithMarkers, markerFault } from "./conflict-markers.mjs"
import { barSigned, commentsArgs, commentsFrom, countersignFor, verifierSteps } from "./countersign.mjs"
import { readWithRetry } from "./github-read.mjs"
import { judgeCheck } from "./land-check.mjs"
import { followPull } from "./land-follow.mjs"
import {
  behindMain,
  changedOnBranch,
  conflictsWithMain,
  currentBranch,
  dirtyFiles,
  runner,
  succeeds,
} from "./land-git.mjs"
import { statusLines } from "./land-status.mjs"
import { mergesSince, rebuildBranch, rebuildLine } from "./linear-branch.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { awaitChecks, enqueue, queueLine, readPull } from "./merge-queue.mjs"
import { recordRace } from "./race-issue.mjs"
import { migrationFault, recordFile } from "./migration-numbers.mjs"
import { branchBodyFaults } from "./pr-body.mjs"
import { baseFault } from "./pull-base.mjs"
import { editLines, editPull, pullEdits } from "./pull-edit.mjs"
import { restoredLimit, staleFault, staleFiles } from "./stale-tree.mjs"
import { sweepLine } from "./sweep.mjs"
import { hasProof, titleAdvice, titleLimit, titleVerdict } from "./title.mjs"

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
      ? gh([
          "pr",
          "list",
          "--head",
          branch,
          "--state",
          "open",
          "--json",
          "number,baseRefName,url,title,body",
          "--limit",
          "1",
        ])
      : gh(["pr", "view", String(number), "--json", "number,baseRefName,url"])
  const parsed = JSON.parse(succeeds(found, "could not read the pull request"))
  return number === undefined ? parsed[0] : parsed
}

class Stop extends Error {}

const readBody = (readText, file, stop) => {
  if (file === undefined) return undefined
  try {
    return readText(file)
  } catch (error) {
    return stop("body", `the body file ${file} cannot be read: ${error.message}`)
  }
}

const openAdvice = `Open one against main: pnpm land --title "..." --body-file <file>.`

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export const land = async (ctx) => {
  const { args, git, gh, say, sleep = pause, now = () => Date.now() } = ctx
  const readText = ctx.readText ?? ((file) => fs.readFileSync(file, "utf8"))
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
  const followed = (number, branch) =>
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
  const follow = async (number, branch) => {
    const code = await followed(number, branch)
    if (code === 0) say(sweepLine)
    return code
  }
  try {
    const branch = args.pr === undefined || !(args.status || args.watch) ? currentBranch(git) : "(by number)"
    succeeds(git(["fetch", "origin", "main"]), "could not fetch origin/main")
    if (args.status || args.watch) {
      const pull = findPull({ gh, branch, number: args.pr })
      if (pull === undefined) stop("pull request", `${branch} has no open pull request. ${openAdvice}`)
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
    if (pull === undefined) {
      if (!args.checkOnly && (args.title === undefined || args.bodyFile === undefined))
        stop("pull request", `${branch} has no pull request. ${openAdvice}`)
      line("base", "no pull request yet; it will open against main")
    } else if (pull.baseRefName === "main") line("base", `pull request ${pull.number} targets main`)
    else line("base", `pull request ${pull.number} targets ${pull.baseRefName}; land moves it to main before the push`)
    const title = args.title ?? pull?.title
    if (title !== undefined) {
      const fault = titleVerdict(title)
      const named = args.title === undefined ? `the title of pull request ${pull.number}` : "--title"
      const retitle = args.title === undefined ? ` Retitle it: pnpm land --title "...".` : ""
      if (fault !== undefined) stop("title", `${named} is ${fault}. ${titleAdvice}${retitle}`)
      line("title", `${[...title].length} characters, within the limit of ${titleLimit}`)
    }
    if (mergesSince(git).length === 0) line("linear", "no merge commit since origin/main")
    else {
      const rebuilt = rebuildBranch(git, { message: title })
      if (!rebuilt.ok) stop("linear", rebuilt.why)
      line("linear", rebuildLine(rebuilt))
    }
    const bodyFromFile = readBody(readText, args.bodyFile, stop)
    const body = bodyFromFile ?? pull?.body
    const attribution = body === undefined ? undefined : attributionLine(body)
    if (attribution !== undefined)
      stop(
        "body",
        bodyFromFile === undefined
          ? `the body of pull request ${pull.number} has the attribution line "${attribution}". Delete that line: write the body to a file without it and run pnpm land --body-file <file>.`
          : `${args.bodyFile} has the attribution line "${attribution}". Delete that line, then run pnpm land again.`,
      )
    const bodyFaults = body === undefined ? [] : branchBodyFaults({ body, git, repository })
    if (bodyFaults.length > 0) stop("body", `${bodyFaults.join(" ")} Fix the body, then run pnpm land again.`)
    if (body === undefined)
      line("body", "not judged here: pass --body-file, or the bar check judges it on the pull request")
    if (body !== undefined && !hasProof(body))
      line(
        "body",
        "warning: the body has no ## Evidence heading. Say what you ran and what you saw, before and after, with counts.",
      )
    const conflicts = conflictsWithMain(git)
    if (conflicts.length > 0) {
      stop(
        "conflicts",
        `this branch conflicts with origin/main in ${conflicts.join(", ")}. Rebase now, before the check: git rebase origin/main, resolve, then run pnpm land again.`,
      )
    }
    line("conflicts", `none; ${behindMain(git)} commits behind origin/main`)
    const stale = staleFault(staleFiles(git))
    if (stale !== undefined) stop("restored-files", stale)
    line("restored-files", `none; fewer than ${restoredLimit} files put back to content main replaced`)
    const numbers = migrationFault({ base: jsonAt(git, "origin/main"), head: jsonAt(git, "HEAD") })
    if (numbers !== undefined) stop("migrations", numbers)
    line("migrations", "no migration number is taken on origin/main")
    const early = markerFault(filesWithMarkers(git))
    if (early !== undefined) stop("markers", early)
    line("markers", "no conflict marker in the commit")
    line("gate", "running pnpm gate: the cheap checks, then the build and the tests this diff reaches")
    const commit = succeeds(git(["rev-parse", "HEAD"]), "could not read HEAD").trim()
    const verdict = await judgeCheck({
      ...(await ctx.check()),
      rerun: ctx.rerun,
      changed: changedOnBranch(git),
      record: ({ test, excerpt }) =>
        recordRace({
          gh,
          repository,
          test,
          excerpt,
          commit,
          seen: `in pnpm gate on branch ${branch} and passed when pnpm land ran its file alone`,
        }),
      say: (text) => line("gate", text),
    })
    if (!verdict.passed) stop("gate", verdict.how)
    ctx.stamp()
    line("gate", `${verdict.how}; the commit is stamped for the push guard, and ci runs every step of pnpm check`)
    if (args.checkOnly) return 0
    const late = markerFault(filesWithMarkers(git))
    if (late !== undefined) stop("markers", late)
    const fields = pull === undefined ? {} : pullEdits({ pull, title: args.title, body: bodyFromFile })
    if (Object.keys(fields).length > 0) {
      editPull({ gh, repository, number: pull.number, fields })
      for (const each of editLines(pull.number, fields)) line("edited", each)
      pull = { ...pull, baseRefName: fields.base ?? pull.baseRefName }
    }
    const pushed = git(["push", "--force-with-lease", "--set-upstream", "origin", branch])
    if (pushed.status !== 0) stop("push", `git push refused: ${(pushed.stderr || pushed.stdout).trim()}`)
    line("push", `${branch} pushed with a lease`)
    if (pull === undefined) {
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
    const signed = ctx.countersign?.({ number: pull.number, repository })
    if (signed?.line !== undefined) line("bar", signed.line)
    if (signed !== undefined && !signed.pass) {
      for (const each of verifierSteps(pull.number)) line("next", each)
      return 0
    }
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
  const git = runner("git", root)
  const gh = runner("gh", root)
  const code = await land({
    args: parseArgs(process.argv.slice(2)),
    git,
    gh,
    check: () => tee(process.execPath, ["scripts/gate.mjs"], process.env, root),
    rerun: async (file) => {
      const release = await takeMachineLock({ job: "rerun", lane: "small", say: console.error })
      const tree = workingTree(root)
      let status = "exited"
      try {
        const [command, args, env] = checkSteps.aloneCommand(file)
        const ran = await tee(command, args, { ...process.env, ...env }, root)
        status = ran.status === 0 ? "passed" : "failed"
        return ran
      } finally {
        await release({ status, file, tree })
      }
    },
    stamp: () => stampChecked(root),
    countersign: ({ number, repository }) => {
      const read = readLocal(root)
      if (read.why !== undefined) return undefined
      const { lowers } = verdict(read)
      const head = succeeds(git(["rev-parse", "HEAD"]), "could not read HEAD").trim()
      const comments = lowers
        ? commentsFrom(succeeds(gh(["api", ...commentsArgs(repository, number)]), "could not read the comments"))
        : []
      return barSigned({ lowers, head, countersign: countersignFor(comments, head) })
    },
    say,
  })
  process.exit(code)
}

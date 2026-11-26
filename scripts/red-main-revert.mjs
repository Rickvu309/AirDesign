import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readLocal, verdict } from "./bar.mjs"
import { jobsReachedBy } from "./change-map.mjs"
import { countersignBody } from "./countersign.mjs"
import { freshRunComment, freshRunVerdict, postFreshRun, recordRaces, reopenPull } from "./fresh-run.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { failureLines } from "./land-report.mjs"
import { openIssues } from "./race-issue.mjs"
import { recordEndedRaces, recordRun } from "./red-main-records.mjs"
import { decide } from "./red-main-verdict.mjs"
import { cleanRead, revertPull, runUrl } from "./red-main-revert-report.mjs"
import { fileAddedBetween, greenRerun, rerunProcess } from "./green-rerun.mjs"
import { drillBranch, finishDrill, removeDrillBranch } from "./red-main-drill.mjs"

export const branchPrefix = "red-main/revert-"
export const revertBranch = (sha) => `${branchPrefix}${sha}`

const lines = (answer) => (answer.status === 0 ? answer.stdout.split("\n").filter((line) => line !== "") : [])

const mainCommits = (io) => {
  const fetched = io.git(["fetch", "--no-tags", "origin", "main"])
  return fetched.status === 0 ? lines(io.git(["rev-list", "--first-parent", "-n", "300", "origin/main"])).reverse() : []
}

const mainState = ({ repository, io }) => {
  const commits = mainCommits(io)
  const listed = io.gh([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    "ci.yml",
    "--branch",
    "main",
    "--event",
    "push",
    "--limit",
    "100",
    "--json",
    "databaseId,headSha,status,conclusion",
  ])
  if (listed.status !== 0) return { why: `the ci runs on main could not be listed: ${listed.stderr.trim()}` }
  const runs = JSON.parse(listed.stdout).map((run) => ({
    id: run.databaseId,
    sha: run.headSha,
    status: run.status,
    conclusion: run.conclusion,
    event: "push",
  }))
  const issues = openIssues({ gh: io.gh, repository })
  if (issues.why !== undefined) return { why: issues.why }
  const races = new Set(issues.open.map((issue) => issue.title).filter((title) => title.startsWith("Race: ")))
  return { commits, runs, races }
}

const newerGreen = ({ runs, commits, target }) => {
  const from = commits.indexOf(target)
  return runs.find((run) => run.conclusion === "success" && from !== -1 && commits.indexOf(run.sha) > from)
}

const short = (sha) => sha.slice(0, 7)

const revertCiPassed = ({ repository, io, branch, head }) => {
  const listed = io.gh([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    "ci.yml",
    "--branch",
    branch,
    "--limit",
    "20",
    "--json",
    "databaseId,headSha,status,conclusion",
  ])
  const runs = listed.status === 0 ? JSON.parse(listed.stdout || "[]") : []
  const [latest] = runs.filter((run) => run.headSha === head).sort((left, right) => right.databaseId - left.databaseId)
  return latest?.status === "completed" && latest.conclusion === "success"
}

const mergeRevert = ({ repository, io, number, head, target, why }) => {
  if (io.owner === undefined) return { failed: true, why: "RED_MAIN_TOKEN is missing" }
  const merged = io.owner([
    "pr",
    "merge",
    String(number),
    "--repo",
    repository,
    "--rebase",
    "--match-head-commit",
    head,
  ])
  const queued =
    merged.status === 0
      ? merged
      : io.owner([
          "pr",
          "merge",
          String(number),
          "--repo",
          repository,
          "--auto",
          "--rebase",
          "--match-head-commit",
          head,
        ])
  if (queued.status !== 0) {
    io.redMain(`The revert of ${target} passed ci, and merging it failed: ${queued.stderr.trim()}`)
    return { failed: true }
  }
  io.redMain(`${why}, so the bot merged the revert of ${target}.`)
  return { failed: false }
}

const confirmation = (repository, decision) => {
  const tests = decision.judgment.tests.filter((each) => each.repeated).map((each) => each.title.replace(/^Race: /, ""))
  return tests.length === 0
    ? `ci on main is red for certain in run ${runUrl(repository, decision.judgment.run.id)}, and the revert passed ci while main was still red`
    : `${tests.join(", ")} failed on main in run ${runUrl(repository, decision.run.id)} and again in run ${runUrl(repository, decision.judgment.run.id)}, and the revert passed ci while main was still red`
}

const openRevert = ({ repository, io, decision, event, say, drill }) => {
  const target = drill?.sha ?? decision.target
  const branch = drill ? drillBranch(drill) : revertBranch(target)
  const title = io.git(["log", "-1", "--format=%s", target]).stdout.trim()
  const fail = (line) => ({ ...say(line), failed: true })
  if (/^Revert\b/.test(title)) {
    if (drill) return fail(`the drill target ${target} is itself a revert`)
    io.redMain(
      `ci is red on main, and the first red commit ${target} is itself a revert. The bot reverts no revert: fix forward. ${runUrl(repository, decision.run.id)}`,
    )
    return { failed: false }
  }
  if (io.owner === undefined) {
    if (drill) return fail("RED_MAIN_TOKEN is missing")
    io.redMain(
      `ci is red on main, and the first red commit is ${target}. The bot opened no revert: the RED_MAIN_TOKEN secret is missing, and a pull request opened with the workflow's own token runs no checks. ${runUrl(repository, decision.run.id)}`,
    )
    say("RED_MAIN_TOKEN is missing")
    return { failed: true }
  }
  const known = io.owner([
    "pr",
    "list",
    "--repo",
    repository,
    "--head",
    branch,
    "--state",
    "all",
    "--json",
    "number,state,url,headRefOid",
  ])
  const [pull] = known.status === 0 ? JSON.parse(known.stdout || "[]") : []
  if (drill && (known.status !== 0 || pull !== undefined))
    return fail(`could not establish that ${branch} has no pull request: ${pull?.url ?? known.stderr.trim()}`)
  if (pull?.state === "OPEN") {
    if (decision.action !== "revert" || !revertCiPassed({ repository, io, branch, head: pull.headRefOid }))
      return say(`the revert of ${target} is open: ${pull.url}`)
    return mergeRevert({
      repository,
      io,
      number: pull.number,
      head: pull.headRefOid,
      target,
      why: confirmation(repository, decision),
    })
  }
  if (pull !== undefined) {
    io.redMain(
      `ci is still red on main in run ${runUrl(repository, event.id)}. The revert of ${target} is ${pull.state.toLowerCase()} (${pull.url}), so the bot opens no other: fix forward.`,
    )
    return { failed: false }
  }
  const culprits = io.gh(["api", `repos/${repository}/commits/${target}/pulls`, "--jq", "[.[] | {number, body}]"])
  const [culprit] = culprits.status === 0 ? JSON.parse(culprits.stdout || "[]") : []
  const changedFiles = lines(io.git(["show", "--name-only", "--format=", target]))
  const read = drill ? { jobs: [] } : io.jobsOf(decision.run)
  const pullText = revertPull({
    repository,
    target,
    title,
    number: culprit?.number,
    culprit: culprit?.body ?? "",
    decision,
    failure: drill ? [] : io.failure(decision.run, read),
    changedFiles,
    jobs: read.jobs,
    drill,
  })
  const checkedOut = io.git(["checkout", "-B", branch, "origin/main"])
  if (checkedOut.status !== 0) return fail(`could not check out ${branch}: ${checkedOut.stderr.trim()}`)
  if (io.git(["revert", "--no-commit", target]).status !== 0) {
    io.git(["revert", "--abort"])
    if (drill) return fail(`the drill could not revert ${target} on main`)
    io.redMain(
      `ci is red on main, and the first red commit is ${target}. Its revert conflicts with what main holds now, so the bot opened none: fix forward. ${runUrl(repository, decision.run.id)}`,
    )
    return { failed: false }
  }
  const committed = io.git(["commit", "--file", "-"], pullText.message)
  const pushed =
    committed.status === 0 ? io.git(["push", io.remote ?? "origin", `HEAD:refs/heads/${branch}`]) : committed
  if (pushed.status !== 0) {
    say(`the revert of ${target} could not be committed or pushed: ${pushed.stderr.trim()}`)
    return { failed: true }
  }
  const head = io.git(["rev-parse", "HEAD"]).stdout.trim()
  const lowers = io.lowersTheBar()
  const created = io.owner(
    [
      "pr",
      "create",
      "--repo",
      repository,
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      pullText.title,
      "--body-file",
      "-",
    ],
    pullText.body,
  )
  if (created.status !== 0) {
    say(`gh pr create failed: ${created.stderr.trim()}`)
    if (drill) removeDrillBranch({ io, branch, head, say })
    return { failed: true }
  }
  const url = created.stdout.trim().split("\n").at(-1)
  if (lowers)
    io.owner([
      "api",
      `repos/${repository}/issues/${url.split("/").at(-1)}/comments`,
      "-f",
      `body=${countersignBody({ head, verdict: "right", reason: `an exact revert of ${target}${drill ? " for the red-main drill" : ", which turned ci on main red"} that puts back the bar main had before that commit` })}`,
    ])
  if (drill) return { failed: false, url, head, branch }
  const from = `${target}${culprit === undefined ? "" : ` from #${culprit.number}`}`
  io.redMain(
    decision.action === "suspect"
      ? `ci failed on main in run ${runUrl(repository, decision.run.id)}, only in browser tests that the first red commit ${from} reaches through app code. One red may be a race, so the bot opened ${url} on branch ${branch} to revert it, and merges it only once a later push run on main fails the same test. If a later push run passes first, it closes the revert and records the race.`
      : `ci failed on main in run ${runUrl(repository, decision.run.id)}. The first red commit is ${from}. The bot opened ${url} on branch ${branch} to revert it, and merges it once its ci passes while main is still red.`,
  )
  return { failed: false }
}

const closePull = ({ repository, io, number, comment }) =>
  io.gh(["pr", "close", String(number), "--repo", repository, "--comment", `${comment}`])

const closeRevert = ({ repository, io, number, green, raceUrls = [] }) =>
  closePull({
    repository,
    io,
    number,
    comment:
      raceUrls.length === 0
        ? `ci passed on main at ${green.sha} (${runUrl(repository, green.id)}) before this revert landed. Someone fixed forward, so the bot closes it.`
        : `ci passed on main at ${green.sha} (${runUrl(repository, green.id)}) before any later push run failed the same test again. The failure was a race, recorded in ${raceUrls.join(", ")}, so the bot closes this revert of a good commit.`,
  })

const closeFixedForward = ({ repository, io, state, green, races }) => {
  const recorded = recordEndedRaces({ repository, io, races, green })
  const listed = io.gh([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--limit",
    "100",
    "--json",
    "number,headRefName,isCrossRepository",
  ])
  const pulls = listed.status === 0 ? JSON.parse(listed.stdout || "[]") : []
  for (const pull of pulls.filter((each) => each.headRefName.startsWith(branchPrefix) && !each.isCrossRepository)) {
    const target = pull.headRefName.slice(branchPrefix.length)
    if (newerGreen({ runs: [green], commits: state.commits, target }) !== undefined)
      closeRevert({ repository, io, number: pull.number, green, raceUrls: recorded.urls })
  }
  if (recorded.why === undefined) return { failed: false }
  io.redMain(
    `ci passed on main at ${short(green.sha)} after a failure the bot judged a race, and the race could not be recorded: ${recorded.why}`,
    true,
  )
  return { failed: true }
}

const followFailedRevert = ({ repository, io, event, target, number, head }) => {
  const stop = (why) => {
    io.redMain(
      `ci failed on the revert of ${target} in ${runUrl(repository, event.id)}. ${why}. Fix forward on main or fix the revert.`,
    )
    return { failed: false }
  }
  const { jobs, warnings = [] } = io.jobsOf(event)
  if (warnings.length > 0) return stop(warnings[0])
  const verdict = freshRunVerdict({ gh: io.gh, repository, number, head, jobs, byMap: true })
  if (!verdict.take) {
    if (verdict.after === event.id) return { failed: false }
    return stop(verdict.why)
  }
  if (io.owner === undefined) return stop("RED_MAIN_TOKEN is missing")
  const { tests } = verdict
  const races = recordRaces({ gh: io.gh, repository, run: event, head, tests, jobs })
  if (races.why !== undefined) return stop(races.why)
  const body = freshRunComment({ repository, run: event, head, tests, queue: false, races: races.urls, byMap: true })
  const fault =
    postFreshRun({ gh: io.gh, repository, number, body }) ?? reopenPull({ gh: io.owner, repository, number })
  if (fault !== undefined) return stop(fault)
  return { failed: false }
}

const followRevert = ({ repository, io, event, say }) => {
  if (event.attempt !== undefined && event.attempt !== 1) return say("the revert bot follows run attempt 1")
  const target = event.branch.slice(branchPrefix.length)
  const listed = io.gh([
    "pr",
    "list",
    "--repo",
    repository,
    "--head",
    event.branch,
    "--state",
    "open",
    "--json",
    "number,headRefOid,isCrossRepository",
  ])
  const [pull] = listed.status === 0 ? JSON.parse(listed.stdout || "[]") : []
  if (pull === undefined || pull.isCrossRepository || pull.headRefOid !== event.sha)
    return say(`no open revert from this repository has head ${event.sha}`)
  const number = String(pull.number)
  const state = mainState({ repository, io })
  if (state.why !== undefined) return say(state.why)
  const green = newerGreen({ runs: state.runs, commits: state.commits, target })
  if (green !== undefined) {
    closeRevert({ repository, io, number, green })
    return { failed: false }
  }
  if (event.conclusion !== "success")
    return followFailedRevert({ repository, io, event, target, number, head: pull.headRefOid })
  const decision = decideMain(state, io)
  if (decision.action !== "revert" || decision.target !== target) {
    io.gh([
      "pr",
      "comment",
      number,
      "--repo",
      repository,
      "--body",
      `ci passed on this revert in ${runUrl(repository, event.id)}. Main is not yet red for certain at this commit, so the bot leaves it open: it merges it once a later push run on main fails the same test, and closes it if a push run on main passes first.`,
    ])
    return say(`the revert of ${target} waits for a second red on main`)
  }
  const merged = mergeRevert({
    repository,
    io,
    number,
    head: event.sha,
    target,
    why: confirmation(repository, decision),
  })
  if (merged.why !== undefined) say(merged.why)
  return { failed: merged.failed }
}

const filesBetween = (io) => (from, to) => {
  const answer = io.git(["diff", "--name-only", "--no-renames", from, to])
  return answer.status === 0 ? lines(answer) : undefined
}

const decideMain = (state, io) =>
  decide({
    ...state,
    jobsOf: io.jobsOf,
    filesBetween: filesBetween(io),
    rerun: io.rerun,
    jobsReached: jobsReachedBy,
    addedBetween: fileAddedBetween(io.git),
  })

export const redMainBot = async ({ repository, event, io }) => {
  const said = []
  const say = (line) => {
    said.push(line)
    return { failed: false, said }
  }
  if (event.event === "workflow_dispatch") {
    if (!/^[0-9a-f]{40}$/.test(event.sha) || !mainCommits(io).includes(event.sha))
      return { ...say("drill_sha must be a full SHA in main's last 300 first-parent commits"), failed: true }
    const pull = openRevert({ repository, io, event, say, drill: event })
    if (pull.failed) return { said, failed: true }
    const close = (comment) => closePull({ repository, io, number: pull.url, comment })
    return { said, ...(await finishDrill({ repository, io, pull, close, say })) }
  }
  const bot = { ...io, jobsOf: (run) => cleanRead(io.jobsOf(run)) }
  if (event.event === "pull_request") {
    if (!event.branch.startsWith(branchPrefix)) return say("not a revert branch")
    return { said, ...followRevert({ repository, io: bot, event, say }) }
  }
  const state = mainState({ repository, io })
  if (state.why !== undefined) return { said, failed: true, why: state.why }
  const at = state.commits.indexOf(event.sha)
  const atEvent = { ...state, runs: state.runs.filter((run) => state.commits.indexOf(run.sha) <= at) }
  if (event.conclusion === "success") {
    const green = decideMain(atEvent, bot)
    if (green.action !== "green") return say(`the passing push at ${event.sha} is not in the ci history yet`)
    return { said, ...closeFixedForward({ repository, io: bot, state, green: green.green, races: green.races }) }
  }
  const decision = decideMain(state, bot)
  if (decision.action === "green") {
    const ended = decideMain(atEvent, bot).judged.find((each) => each.run.id === event.id)
    return { said, ...recordRun({ repository, io: bot, event, judged: ended, ended: true }) }
  }
  if (decision.action === "wait") return say(`waiting for ci run ${decision.run.id} on ${decision.run.sha}`)
  const judged = decision.judged.find((each) => each.run.id === event.id)
  const recorded = recordRun({ repository, io: bot, judged, event })
  if (decision.action !== "suspect" && decision.action !== "revert") return { said, ...recorded }
  const opened = openRevert({ repository, io: bot, decision, event, say })
  return { said, failed: recorded.failed || opened.failed }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const repository = process.env.GITHUB_REPOSITORY
  const runner = (command, token) => (args, input) => {
    const env = { ...process.env, NO_COLOR: "1", ...(token === undefined ? {} : { GH_TOKEN: token }) }
    const done = spawnSync(command, args, { cwd: root, encoding: "utf8", input, env, maxBuffer: 512 * 2 ** 20 })
    return { status: done.status ?? 1, stdout: done.stdout ?? "", stderr: done.stderr ?? "" }
  }
  const token = process.env.RED_MAIN_TOKEN || undefined
  const gh = runner("gh")
  const io = {
    gh,
    owner: token === undefined ? undefined : runner("gh", token),
    git: runner("git"),
    remote: token === undefined ? undefined : `https://x-access-token:${token}@github.com/${repository}.git`,
    jobsOf: (run) => failedJobLogs({ repository, run, gh, reads: 3 }),
    rerun: greenRerun({ root, run: rerunProcess, say: (line) => console.log(line) }),
    failure: (run, read) => failureLines({ repository, run, gh, read }).lines,
    lowersTheBar: () => {
      const read = readLocal(root)
      return read.why !== undefined || verdict(read).lowers
    },
    redMain: (body, existingOnly = false) =>
      spawnSync("bash", [path.join(root, "scripts/red-main.sh")], {
        env: { ...process.env, RED_BODY: body, RED_EXISTING_ONLY: existingOnly ? "1" : "" },
        stdio: "inherit",
      }),
  }
  const event =
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
      ? {
          event: "workflow_dispatch",
          id: Number(process.env.GITHUB_RUN_ID),
          attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
          sha: process.env.DRILL_SHA,
        }
      : {
          id: Number(process.env.RUN_ID),
          attempt: Number(process.env.RUN_ATTEMPT || 1),
          event: process.env.RUN_EVENT,
          branch: process.env.RUN_BRANCH,
          sha: process.env.RUN_SHA,
          conclusion: process.env.RUN_CONCLUSION,
        }
  const result = await redMainBot({ repository, event, io })
  for (const line of [...(result.said ?? []), ...(result.why === undefined ? [] : [result.why])]) console.log(line)
  if (result.failed) process.exit(1)
}

import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { beforeAfterSection, hasBeforeAfter, noVisibleChange, seen } from "./before-after.mjs"
import { readLocal, verdict } from "./bar.mjs"
import { countersignBody } from "./countersign.mjs"
import { plainLog } from "./failed-tests.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { failureLines } from "./land-report.mjs"
import { agentHeader, failureExcerpt, openIssues, recordRace } from "./race-issue.mjs"
import { decide } from "./red-main-verdict.mjs"
import { titleFaults } from "./title.mjs"

export const branchPrefix = "red-main/revert-"
export const revertBranch = (sha) => `${branchPrefix}${sha}`

const runnerPath = /\/home\/runner\/work\/[^/\s]+\/[^/\s]+\//g
const excerptLimit = 2
const runUrl = (repository, id) => `https://github.com/${repository}/actions/runs/${id}`
const short = (sha) => sha.slice(0, 7)
const checkProgress = /^(?:judge (?:break|valid|proof)|phase) /

const withoutProgress = (log) =>
  log
    .split("\n")
    .filter((line) => !checkProgress.test(plainLog(line)))
    .join("\n")

const cleanRead = (read) => ({
  ...read,
  jobs: read.jobs.map((job) => ({ ...job, log: withoutProgress(job.log) })),
  logs: read.logs.map(withoutProgress),
})

const beforeAttachment = (excerpt) => {
  const kept = []
  for (const line of excerpt.split("\n")) {
    if (/^\s*attachment #/.test(line)) break
    kept.push(line)
  }
  while (kept.at(-1)?.trim() === "") kept.pop()
  return kept.join("\n")
}

const lines = (answer) => (answer.status === 0 ? answer.stdout.split("\n").filter((line) => line !== "") : [])
const pullTitle = (target, title) => {
  const quoted = `Revert "${title}"`
  return titleFaults(quoted).length === 0 ? quoted : `Revert ${short(target)}, which turned main red`
}

const beforeAfter = ({ repository, named, culprit, changedFiles }) => {
  if (hasBeforeAfter(culprit, repository) && noVisibleChange(culprit) === undefined) {
    const images = (beforeAfterSection(culprit) ?? "")
      .split("\n")
      .filter((line) => /!\[[^\]]*\]\(https:\/\/github\.com\//.test(line))
    return ["## Before / after", "", `This puts back the before side of ${named}'s image:`, "", ...images, ""]
  }
  const unseen = noVisibleChange(culprit)
  if (unseen !== undefined)
    return ["## Before / after", "", `No visible change: this reverts ${named}, whose body says: ${unseen}`, ""]
  if (!changedFiles.some(seen)) return []
  return ["## Before / after", "", `This puts back what main showed before ${named}, whose body has no image.`, ""]
}

export const revertPull = ({
  repository,
  target,
  title,
  number,
  culprit = "",
  decision,
  failure,
  changedFiles,
  jobs,
}) => {
  const named = number === undefined ? `commit \`${short(target)}\`` : `#${number}`
  const real = decision.judged.at(-1)
  const whys = [
    ...real.checks.map((check) => `${check} failed, and a failed check is never a race`),
    ...real.tests
      .filter((each) => each.verdict === "real")
      .map((each) => `${each.title.replace(/^Race: /, "")}: ${each.why}`),
  ]
  const log = jobs.map((job) => withoutProgress(job.log)).join("\n")
  const excerpts = real.tests
    .filter((each) => each.verdict === "real")
    .slice(0, excerptLimit)
    .flatMap((each) => ["~~~text", beforeAttachment(failureExcerpt(log, each.test)).replace(runnerPath, ""), "~~~", ""])
  const pullTitleText = pullTitle(target, title)
  const body = [
    agentHeader,
    "",
    "## Summary",
    "",
    `ci failed on main, and the first red commit is \`${short(target)}\` from ${named}, "${title}". This reverts it so main goes green again. The red-main bot merges this pull request once its ci passes while main is still red. It closes it instead if main goes green first, because someone fixed forward.`,
    "",
    `- First red run: ${runUrl(repository, decision.run.id)} at \`${short(decision.run.sha)}\``,
    `- Last green run: ${runUrl(repository, decision.green.id)} at \`${short(decision.green.sha)}\``,
    "",
    "## Evidence",
    "",
    `Failed jobs: ${jobs.map((job) => job.name).join(", ")}.`,
    "",
    "~~~text",
    ...failure.map((line) => line.replace(runnerPath, "")),
    "~~~",
    "",
    "Why this is not a race:",
    "",
    ...whys.map((why) => `- ${why}`),
    "",
    ...excerpts,
    ...beforeAfter({ repository, named, culprit, changedFiles }),
    "## Merge Danger",
    "",
    `**Door:** two-way. ${named} lands again once it passes against this failure.`,
    "",
    `**Blast Radius:** what ${named} changed. It leaves main until it lands again.`,
    "",
  ].join("\n")
  const message = [
    pullTitleText,
    "",
    `This reverts commit ${target}, the first red commit on main in ci run ${runUrl(repository, decision.run.id)}.`,
    "",
    ...changedFiles.map((file) => `Reverts: ${file}`),
    "",
  ].join("\n")
  return { title: pullTitleText, body, message }
}

const mainState = ({ repository, io }) => {
  io.git(["fetch", "--no-tags", "origin", "main"])
  const commits = lines(io.git(["rev-list", "--first-parent", "-n", "300", "origin/main"])).reverse()
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

const openRevert = ({ repository, io, decision, event, say }) => {
  const { target } = decision
  const branch = revertBranch(target)
  const title = io.git(["log", "-1", "--format=%s", target]).stdout.trim()
  if (/^Revert\b/.test(title)) {
    io.redMain(
      `${agentHeader}\n\nci is red on main, and the first red commit ${target} is itself a revert. The bot reverts no revert: fix forward. ${runUrl(repository, decision.run.id)}`,
    )
    return { failed: false }
  }
  if (io.owner === undefined) {
    io.redMain(
      `${agentHeader}\n\nci is red on main, and the first red commit is ${target}. The bot opened no revert: the RED_MAIN_TOKEN secret is missing, and a pull request opened with the workflow's own token runs no checks. ${runUrl(repository, decision.run.id)}`,
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
    "number,state,url",
  ])
  const [pull] = known.status === 0 ? JSON.parse(known.stdout || "[]") : []
  if (pull?.state === "OPEN") return say(`the revert of ${target} is open: ${pull.url}`)
  if (pull !== undefined) {
    io.redMain(
      `${agentHeader}\n\nci is still red on main in run ${runUrl(repository, event.id)}. The revert of ${target} is ${pull.state.toLowerCase()} (${pull.url}), so the bot opens no other: fix forward.`,
    )
    return { failed: false }
  }
  const culprits = io.gh(["api", `repos/${repository}/commits/${target}/pulls`, "--jq", "[.[] | {number, body}]"])
  const [culprit] = culprits.status === 0 ? JSON.parse(culprits.stdout || "[]") : []
  const changedFiles = lines(io.git(["show", "--name-only", "--format=", target]))
  const read = io.jobsOf(decision.run)
  const pullText = revertPull({
    repository,
    target,
    title,
    number: culprit?.number,
    culprit: culprit?.body ?? "",
    decision,
    failure: io.failure(decision.run, read),
    changedFiles,
    jobs: read.jobs,
  })
  io.git(["checkout", "-B", branch, "origin/main"])
  if (io.git(["revert", "--no-commit", target]).status !== 0) {
    io.git(["revert", "--abort"])
    io.redMain(
      `${agentHeader}\n\nci is red on main, and the first red commit is ${target}. Its revert conflicts with what main holds now, so the bot opened none: fix forward. ${runUrl(repository, decision.run.id)}`,
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
    return { failed: true }
  }
  const url = created.stdout.trim().split("\n").at(-1)
  if (lowers)
    io.owner([
      "api",
      `repos/${repository}/issues/${url.split("/").at(-1)}/comments`,
      "-f",
      `body=${countersignBody({ head, verdict: "right", reason: `an exact revert of ${target}, which turned ci on main red; it puts back the bar main had before that commit` })}`,
    ])
  io.redMain(
    `${agentHeader}\n\nci failed on main in run ${runUrl(repository, decision.run.id)}. The first red commit is ${target}${culprit === undefined ? "" : ` from #${culprit.number}`}. The bot opened ${url} on branch ${branch} to revert it, and merges it once its ci passes while main is still red.`,
  )
  return { failed: false }
}

const recordRun = ({ repository, io, judged, event }) => {
  if (judged === undefined) return { failed: false }
  if (judged.verdict === "unknown") {
    io.redMain(
      `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)}, and the bot reverts nothing: ${judged.why}. A person or agent reads the log.`,
    )
    return { failed: false }
  }
  const log = io
    .jobsOf(judged.run)
    .jobs.map((job) => job.log)
    .join("\n")
  const urls = []
  for (const each of judged.tests) {
    const kept = recordRace({
      gh: io.gh,
      repository,
      test: each.test,
      excerpt: beforeAttachment(failureExcerpt(log, each.test)).replace(runnerPath, ""),
      commit: event.sha,
      seen: `on main in ci run ${runUrl(repository, event.id)}, where ${each.why}`,
    })
    if (kept.why !== undefined) {
      io.redMain(
        `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)} on a race, and the race could not be recorded: ${kept.why}`,
      )
      return { failed: true }
    }
    urls.push(kept.url)
  }
  io.redMain(
    `${agentHeader}\n\nci failed on main in run ${runUrl(repository, event.id)} only on races, recorded in ${[...new Set(urls)].join(", ")}. The bot reverts nothing. The next push to main runs ci again, and if the same test fails there, the bot reverts the first red commit.`,
  )
  return { failed: false }
}

const closeRevert = ({ repository, io, number, green }) =>
  io.gh([
    "pr",
    "close",
    String(number),
    "--repo",
    repository,
    "--comment",
    `${agentHeader}\n\nci passed on main at ${green.sha} (${runUrl(repository, green.id)}) before this revert landed. Someone fixed forward, so the bot closes it.`,
  ])

const closeFixedForward = ({ repository, io, state, green }) => {
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
      closeRevert({ repository, io, number: pull.number, green })
  }
  return { failed: false }
}

const followRevert = ({ repository, io, event, say }) => {
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
  if (event.conclusion !== "success") {
    io.gh([
      "pr",
      "comment",
      number,
      "--repo",
      repository,
      "--body",
      `${agentHeader}\n\nci failed on this revert in ${runUrl(repository, event.id)}. The bot never reruns ci, so it leaves this open. Fix forward on main, or fix the revert.`,
    ])
    return { failed: false }
  }
  const state = mainState({ repository, io })
  if (state.why !== undefined) return say(state.why)
  const green = newerGreen({ runs: state.runs, commits: state.commits, target })
  if (green !== undefined) {
    closeRevert({ repository, io, number, green })
    return { failed: false }
  }
  if (io.owner === undefined) {
    say("RED_MAIN_TOKEN is missing")
    return { failed: true }
  }
  const merged = io.owner(["pr", "merge", number, "--repo", repository, "--rebase", "--match-head-commit", event.sha])
  const queued =
    merged.status === 0
      ? merged
      : io.owner(["pr", "merge", number, "--repo", repository, "--auto", "--rebase", "--match-head-commit", event.sha])
  if (queued.status !== 0) {
    io.redMain(`${agentHeader}\n\nThe revert of ${target} passed ci, and merging it failed: ${queued.stderr.trim()}`)
    return { failed: true }
  }
  io.redMain(`${agentHeader}\n\nThe revert of ${target} passed ci while main was still red, so the bot merged it.`)
  return { failed: false }
}

export const redMainBot = async ({ repository, event, io }) => {
  const said = []
  const say = (line) => {
    said.push(line)
    return { failed: false, said }
  }
  if (event.event === "pull_request") {
    if (!event.branch.startsWith(branchPrefix)) return say("not a revert branch")
    return { said, ...followRevert({ repository, io, event, say }) }
  }
  const jobsOf = (run) => cleanRead(io.jobsOf(run))
  const bot = { ...io, jobsOf }
  const state = mainState({ repository, io })
  if (state.why !== undefined) return { said, failed: true, why: state.why }
  const decision = decide({
    ...state,
    jobsOf,
    filesBetween: (from, to) => lines(io.git(["diff", "--name-only", from, to])),
  })
  if (decision.action === "green")
    return { said, ...closeFixedForward({ repository, io, state, green: decision.green }) }
  if (decision.action === "wait") return say(`waiting for ci run ${decision.run.id} on ${decision.run.sha}`)
  if (decision.action === "revert") return { said, ...openRevert({ repository, io: bot, decision, event, say }) }
  const judged = decision.judged.find((each) => each.run.id === event.id)
  return { said, ...recordRun({ repository, io: bot, judged, event }) }
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
    failure: (run, read) => failureLines({ repository, run, gh, read }).lines,
    lowersTheBar: () => {
      const read = readLocal(root)
      return read.why !== undefined || verdict(read).lowers
    },
    redMain: (body) =>
      spawnSync("bash", [path.join(root, "scripts/red-main.sh")], {
        env: { ...process.env, RED_BODY: body },
        stdio: "inherit",
      }),
  }
  const event = {
    id: Number(process.env.RUN_ID),
    event: process.env.RUN_EVENT,
    branch: process.env.RUN_BRANCH,
    sha: process.env.RUN_SHA,
    conclusion: process.env.RUN_CONCLUSION,
  }
  const result = await redMainBot({ repository, event, io })
  for (const line of [...(result.said ?? []), ...(result.why === undefined ? [] : [result.why])]) console.log(line)
  if (result.failed) process.exit(1)
}

import { freshRunVerdict, recordRaces, takeFreshRun } from "./fresh-run.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { ciFailureLines } from "./land-report.mjs"
import { queueLine, readPull, removalLine } from "./merge-queue.mjs"
import { forceTheGap } from "./race-issue.mjs"

const runsOf = ({ gh, repository, event, branch }) => {
  const fields =
    "[.workflow_runs[] | {id, event, branch: .head_branch, head: .head_sha, conclusion, createdAt: .created_at}]"
  const answer = gh([
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?event=${event}&per_page=${event === "merge_group" ? 50 : 20}${event === "merge_group" ? "" : `&branch=${encodeURIComponent(branch)}`}`,
    "--jq",
    fields,
  ])
  return answer.status === 0 ? JSON.parse(answer.stdout || "[]") : []
}

export const failedRunFor = ({ gh, repository, branch, head, number, event }) =>
  runsOf({ gh, repository, event, branch }).find(
    (run) =>
      run.conclusion === "failure" &&
      (event === "merge_group" ? run.branch.startsWith(`gh-readonly-queue/main/pr-${number}-`) : run.head === head),
  )

const summary = (pull) => {
  const { passed, running, failed } = pull.checks
  if (running.length > 0)
    return `checks are running (${passed.length} passed, ${running.length} running${failed.length > 0 ? `, ${failed.length} failed` : ""})`
  if (failed.length > 0) return `checks failed: ${failed.join(", ")}`
  return `checks passed (${passed.length})`
}

const minutes = (milliseconds) => Math.round(milliseconds / 60000)

export const followPull = async ({
  number,
  branch,
  repository,
  read,
  gh,
  git,
  sleep,
  now,
  say,
  interval = 30000,
  graceMs = 180000,
  limitMs = 4 * 60 * 60 * 1000,
}) => {
  const started = now()
  let queuedSeen = false
  let armedSeen = false
  let greenSince
  let lastLine
  const speak = (line) => {
    if (line !== lastLine) say(`follow: ${line}`)
    lastLine = line
  }
  const report = (event, pull) => {
    const run = failedRunFor({ gh, repository, branch, head: pull.head, number, event })
    if (run === undefined) {
      say(`follow: no failed ci run was found for pull request ${number}. Look at: gh pr checks ${number}`)
      return undefined
    }
    const read = failedJobLogs({ repository, run, gh })
    for (const line of ciFailureLines({ repository, run, gh, git, read })) say(line)
    return { run, jobs: read.jobs }
  }
  const ciEnded = (pull) =>
    !runsOf({ gh, repository, event: "pull_request", branch }).some(
      (run) => run.head === pull.head && run.conclusion === null,
    )
  const freshRun = async (event, pull, failure) => {
    if (failure === undefined) return false
    const verdict = freshRunVerdict({ gh, repository, number, head: pull.head, jobs: failure.jobs })
    if (!verdict.take) {
      say(`follow: no fresh run: ${verdict.why}.${verdict.owned ? ` ${forceTheGap}` : ""}`)
      return false
    }
    const races = recordRaces({
      gh,
      repository,
      run: failure.run,
      head: pull.head,
      tests: verdict.tests,
      jobs: failure.jobs,
    })
    if (races.why !== undefined) {
      say(`follow: no fresh run: the race could not be recorded as an issue: ${races.why}.`)
      return false
    }
    for (const url of races.urls) say(`follow: the race is recorded in ${url}.`)
    say(
      `follow: ci failed only in tests this diff cannot reach. Taking the one fresh run for head ${pull.head.slice(0, 7)}.`,
    )
    const fault = await takeFreshRun({
      gh,
      read,
      repository,
      number,
      run: failure.run,
      head: pull.head,
      tests: verdict.tests,
      races: races.urls,
      queue: event === "merge_group",
      sleep,
      now,
      interval,
    })
    if (fault !== undefined) say(`follow: the fresh run did not start: ${fault}`)
    return fault === undefined
  }
  for (;;) {
    const pull = readPull({ read, repository, number })
    if (pull.merged) {
      speak(`merged. pull request ${number} is on main.`)
      return 0
    }
    if (pull.state === "CLOSED") {
      say(`follow: pull request ${number} was closed without merging.`)
      return 1
    }
    if (pull.queued) {
      queuedSeen = true
      speak(queueLine(pull))
    } else if (queuedSeen) {
      await sleep(interval / 6)
      const again = readPull({ read, repository, number })
      if (again.merged) {
        speak(`merged. pull request ${number} is on main.`)
        return 0
      }
      say("follow: dropped from the merge queue. The queue's own run failed:")
      if (removalLine(again) !== undefined) say(`follow: ${removalLine(again)}`)
      const failure = report("merge_group", again)
      const reason = again.removal?.reason
      if (reason !== "failed_checks")
        say(`follow: no fresh run: the queue recorded ${reason ?? "no reason"} for this drop, not failed_checks.`)
      else if (await freshRun("merge_group", again, failure)) {
        queuedSeen = false
        continue
      }
      say(`follow: nothing merged. Fix the failure, push, and run: pnpm land --watch`)
      return 1
    } else {
      speak(`${summary(pull)}; ${queueLine(pull)}${removalLine(pull) === undefined ? "" : `; ${removalLine(pull)}`}`)
    }
    if (!pull.queued && armedSeen && !pull.armed) {
      say(`follow: auto-merge on pull request ${number} was switched off. Arm it again: pnpm land`)
      return 1
    }
    armedSeen ||= pull.armed
    if (!pull.queued && pull.mergeable === "CONFLICTING") {
      say(
        `follow: pull request ${number} conflicts with main. Rebase now: git fetch origin main && git rebase origin/main && pnpm land`,
      )
      return 1
    }
    if (!pull.queued && pull.checks.failed.length > 0 && pull.checks.running.length === 0 && ciEnded(pull)) {
      if (await freshRun("pull_request", pull, report("pull_request", pull))) continue
      return 1
    }
    const green = !pull.queued && pull.checks.running.length === 0 && pull.checks.passed.length > 0
    greenSince = green ? (greenSince ?? now()) : undefined
    if (green && now() - greenSince >= graceMs) {
      say(
        `follow: pull request ${number} is green and has not entered the merge queue for ${minutes(now() - greenSince)} minutes (${queueLine(pull)}). Arm it: gh pr merge ${number} --auto, then pnpm land --watch`,
      )
      return 1
    }
    if (now() - started >= limitMs) {
      say(
        `follow: pull request ${number} is not merged after ${minutes(now() - started)} minutes (${queueLine(pull)}).`,
      )
      return 1
    }
    await sleep(interval)
  }
}

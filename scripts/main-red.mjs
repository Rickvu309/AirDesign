import { failedCauses, failedScripts, failedSteps, failedTests, plainLog } from "./failed-tests.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { agentHeader } from "./race-issue.mjs"

const short = (sha) => sha.slice(0, 8)
const streakRead = 3
const stepMarker = /^fail ([a-z][a-z:-]*) [\d.]+s$/gm

export const jobKind = (name) => name.replace(/ \d+\/\d+\)$/, ")").replace(/ \(\d+\/\d+\)$/, "")

const stepsOf = (log) => [
  ...new Set([...failedSteps(log), ...[...plainLog(log).matchAll(stepMarker)].map((match) => match[1])]),
]

export const failureOf = (jobs) =>
  jobs.flatMap((job) => {
    const kind = jobKind(job.name)
    const tests = [...failedTests(job.log), ...failedScripts(job.log)].map((test) => `${test.file} › ${test.name}`)
    const named =
      tests.length > 0
        ? tests
        : failedCauses(job.log).flatMap((cause) => cause.lines.map((line) => `${cause.step}: ${line}`))
    const steps = stepsOf(job.log).map((step) => `step ${step}`)
    const all = [...new Set([...named, ...steps])]
    return (all.length > 0 ? all : ["nothing named"]).map((what) => `${kind} | ${what}`)
  })

const matches = (pull, main) =>
  pull.length > 0 && !pull.some((each) => each.endsWith("| nothing named")) && pull.every((each) => main.has(each))

const pushRuns = ({ gh, repository }) => {
  const answer = gh([
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=30`,
    "--jq",
    "[.workflow_runs[] | {id, event, branch: .head_branch, head: .head_sha, conclusion, createdAt: .created_at, title: .display_title}]",
  ])
  if (answer.status !== 0) return []
  return JSON.parse(answer.stdout || "[]").filter(
    (run) => run.event === "push" && run.branch === "main" && ["success", "failure"].includes(run.conclusion),
  )
}

const newestStreak = (runs) => {
  const first = runs.findIndex((run) => run.conclusion === "failure")
  if (first === -1) return undefined
  const after = runs.slice(first).findIndex((run) => run.conclusion === "success")
  const streak = after === -1 ? runs.slice(first) : runs.slice(first, first + after)
  return { streak, since: streak.at(-1), healer: first === 0 ? undefined : runs[first - 1] }
}

const failedJobNames = ({ gh, repository, run }) => {
  const answer = gh([
    "api",
    `repos/${repository}/actions/runs/${run.id}/jobs?per_page=100`,
    "--jq",
    '[.jobs[] | select(.conclusion == "failure" and .name != "ci") | {id, name}]',
  ])
  return answer.status === 0 ? [...new Set(JSON.parse(answer.stdout || "[]").map((job) => job.name))] : []
}

const sinceText = (since) => `main is red since ${short(since.head)} (${since.title})`

export const mainRedLine = ({ gh, repository }) => {
  const found = newestStreak(pushRuns({ gh, repository }))
  if (found === undefined || found.healer !== undefined) return undefined
  const jobs = failedJobNames({ gh, repository, run: found.streak[0] })
  return `${sinceText(found.since)}: ${jobs.join(", ") || "no failed job named"}. A failure here that matches it is main's, not this change's.`
}

const revertFor = ({ gh, since }) => {
  const answer = gh([
    "pr",
    "list",
    "--state",
    "open",
    "--search",
    `${since.head} in:body`,
    "--json",
    "number,title,url",
  ])
  if (answer.status !== 0) return undefined
  return JSON.parse(answer.stdout || "[]").find((pull) => /^Revert\b/i.test(pull.title))
}

const minutes = (milliseconds) => Math.round(milliseconds / 60000)

export const mainsFault = async ({ gh, repository, run, jobs, say, sleep, now, interval = 60000, limitMs }) => {
  const found = newestStreak(pushRuns({ gh, repository }))
  if (found === undefined) return { mains: false }
  const { streak, since, healer } = found
  if (run.createdAt < since.createdAt) return { mains: false }
  if (healer !== undefined && run.createdAt >= healer.createdAt) return { mains: false }
  const main = new Set(
    streak.slice(0, streakRead).flatMap((red) => failureOf(failedJobLogs({ repository, run: red, gh }).jobs)),
  )
  const pull = failureOf(jobs)
  if (!matches(pull, main)) return { mains: false }
  const kinds = [...new Set(pull.map((each) => each.split(" | ")[0]))]
  say(`follow: ${sinceText(since)}, not your change: ${kinds.join(", ")}`)
  for (const each of pull) say(`follow:   ${each}`)
  say(
    `follow: ci run ${run.id} on ${short(run.head)} failed only where main's own push runs fail, so it does not count against this pull request.`,
  )
  if (healer !== undefined) {
    say(`follow: main is green again at ${short(healer.head)} (${healer.title}).`)
    return { mains: true, since, healer }
  }
  const revert = revertFor({ gh, since })
  say(
    revert === undefined
      ? `follow: waiting for a push run on main to pass. A revert of ${short(since.head)} or a fix on main ends the wait.`
      : `follow: waiting for main to go green: revert pull request ${revert.number} is open for ${short(since.head)}: ${revert.url}`,
  )
  const started = now()
  for (;;) {
    if (now() - started >= limitMs) {
      say(
        `follow: main is still red after ${minutes(now() - started)} minutes. When a push run on main passes, run pnpm land --watch.`,
      )
      return { mains: true, since }
    }
    await sleep(interval)
    const next = newestStreak(pushRuns({ gh, repository }))
    if (next?.healer !== undefined || next === undefined) {
      const green = next?.healer ?? pushRuns({ gh, repository })[0]
      say(`follow: main is green again at ${short(green.head)} (${green.title}).`)
      return { mains: true, since, healer: green }
    }
  }
}

export const mainGreenComment = ({ repository, run, head, since, healer, queue }) =>
  [
    agentHeader,
    "",
    `ci run https://github.com/${repository}/actions/runs/${run.id} on head ${head.slice(0, 7)} failed only in the jobs and tests main's own push runs failed in, while main was red since ${since.head.slice(0, 7)} (${since.title}).`,
    "",
    `Main is green again at ${healer.head.slice(0, 7)}. ${queue ? "pnpm land put it in the merge queue again" : "pnpm land closed and reopened it"} for a ci run on that main. Nothing was rerun, and this is not the one fresh run for this head.`,
  ].join("\n")

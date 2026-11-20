import { failedSteps, failedTests } from "./failed-tests.mjs"
import { enqueue, readPull } from "./merge-queue.mjs"
import { agentHeader, failureExcerpt, raceTitle, recordRace } from "./race-issue.mjs"
import { ruleFileSuffix } from "./rules.mjs"
export const browserStep = "browser-tests"
const browserTestPaths = [/^tests\/browser\//, /^tests\/journeys\//, /^playwright[\w.]*\.config\.m?ts$/]

export const freshRunMark = (head) => `This is the one fresh run for head ${head}.`

const isJourneys = (job) => /^journeys\b/.test(job.name)

const jobFault = (job) => {
  if (failedTests(job.log).length === 0) return `the failed job ${job.name || "(no name)"} names no failed test`
  if (isJourneys(job)) return undefined
  const steps = failedSteps(job.log)
  if (steps.length === 0) return `the failed job ${job.name || "(no name)"} names no failed step`
  const other = steps.find((step) => step !== browserStep)
  return other === undefined ? undefined : `step ${other} failed, and it is not a browser or journeys step`
}

export const outsideTheDiff = ({ jobs, files }) => {
  if (jobs.length === 0) return { outside: false, why: "no failed job log could be read" }
  for (const job of jobs) {
    const fault = jobFault(job)
    if (fault !== undefined) return { outside: false, why: fault }
  }
  if (files === undefined) return { outside: false, why: "the files this pull request changes could not be read" }
  const touched = files.find(
    (file) => !file.endsWith(ruleFileSuffix) && browserTestPaths.some((pattern) => pattern.test(file)),
  )
  if (touched !== undefined) return { outside: false, owned: true, why: `this pull request changes ${touched}` }
  const tests = jobs.flatMap((job) => failedTests(job.log))
  const changed = tests.find((test) => files.includes(test.file))
  if (changed !== undefined)
    return { outside: false, owned: true, why: `this pull request changes the failed test ${changed.file}` }
  return { outside: true, tests }
}

const lines = (answer) => (answer.status === 0 ? answer.stdout.split("\n").filter((line) => line !== "") : undefined)

export const pullFiles = ({ gh, repository, number }) =>
  lines(gh(["api", "--paginate", `repos/${repository}/pulls/${number}/files?per_page=100`, "--jq", ".[].filename"]))

export const freshRunUsed = ({ gh, repository, number, head }) => {
  const answer = gh([
    "api",
    "--paginate",
    `repos/${repository}/issues/${number}/comments?per_page=100`,
    "--jq",
    ".[].body",
  ])
  return answer.status === 0 ? answer.stdout.includes(freshRunMark(head)) : undefined
}

export const recordRaces = ({ gh, repository, run, head, tests, jobs }) => {
  const log = jobs.map((job) => job.log).join("\n")
  const titles = new Set()
  const urls = []
  for (const test of tests) {
    if (titles.has(raceTitle(test))) continue
    titles.add(raceTitle(test))
    const kept = recordRace({
      gh,
      repository,
      test,
      excerpt: failureExcerpt(log, test),
      commit: head,
      seen: `in ci run https://github.com/${repository}/actions/runs/${run.id} on a pull request that changes none of its files`,
    })
    if (kept.why !== undefined) return { why: kept.why }
    urls.push(kept.url)
  }
  return { urls: [...new Set(urls)] }
}

export const freshRunComment = ({ repository, run, head, tests, queue, races = [] }) =>
  [
    agentHeader,
    "",
    `ci failed on head ${head.slice(0, 7)} only in tests this diff cannot reach: https://github.com/${repository}/actions/runs/${run.id}`,
    "",
    ...tests.map((test) => `- ${test.line === undefined ? test.file : `${test.file}:${test.line}`}: ${test.name}`),
    "",
    `Each one is a race, recorded in ${races.join(", ")}.`,
    "",
    `Every failed step is a browser or journeys step, this pull request changes none of the failed test files, and it changes nothing under tests/browser/. ${queue ? "pnpm land put it in the merge queue again" : "pnpm land closed and reopened it"} for a fresh ci run with run attempt 1. Nothing was rerun. ${freshRunMark(head)} If this head fails again, it stops for a fix. The failed run still counts in the failure report.`,
  ].join("\n")

export const freshRunVerdict = ({ gh, repository, number, head, jobs }) => {
  const judged = outsideTheDiff({ jobs, files: pullFiles({ gh, repository, number }) })
  if (!judged.outside) return { take: false, owned: judged.owned === true, why: judged.why }
  const used = freshRunUsed({ gh, repository, number, head })
  if (used === undefined) return { take: false, why: "the pull request's comments could not be read" }
  if (used) return { take: false, why: `the one fresh run for head ${head.slice(0, 7)} is used` }
  return { take: true, tests: judged.tests }
}

const startLimitMs = 180000

const newerRunStarted = ({ pull, run }) => {
  const failed = pull.runs.find((each) => each.id === run.id)
  return pull.runs.some((each) => each.id > run.id && (failed === undefined || each.workflow === failed.workflow))
}

const awaitNewRun = async ({ read, repository, number, run, sleep, now, interval }) => {
  const started = now()
  for (;;) {
    const pull = readPull({ read, repository, number })
    if (pull.state !== "CLOSED" && newerRunStarted({ pull, run })) return pull
    if (now() - started >= startLimitMs) return undefined
    await sleep(interval)
  }
}

export const takeFreshRun = async ({
  gh,
  read,
  repository,
  number,
  run,
  head,
  tests,
  races,
  queue,
  sleep,
  now,
  interval,
  comment,
}) => {
  const body = comment ?? freshRunComment({ repository, run, head, tests, queue, races })
  const commented = gh(["api", "-X", "POST", `repos/${repository}/issues/${number}/comments`, "-f", `body=${body}`])
  if (commented.status !== 0) return `the comment could not be posted: ${commented.stderr.trim()}`
  if (!queue) {
    const closed = gh(["pr", "close", String(number)])
    if (closed.status !== 0) return `gh pr close failed: ${closed.stderr.trim()}`
    const reopened = gh(["pr", "reopen", String(number)])
    if (reopened.status !== 0)
      return `gh pr reopen failed: ${reopened.stderr.trim()}. Reopen it: gh pr reopen ${number}`
    const started = await awaitNewRun({ read, repository, number, run, sleep, now, interval })
    if (started === undefined)
      return `no ci run started within ${startLimitMs / 60000} minutes of the reopen. Look at: gh pr checks ${number}`
    if (!started.hasQueue) return undefined
  }
  const queued = enqueue({ merge: gh, read, repository, number })
  return queued.ok ? undefined : queued.message
}

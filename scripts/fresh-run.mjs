import { jobsReachedBy } from "./change-map.mjs"
import { failedSteps, failedTests } from "./failed-tests.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { enqueue, readPull } from "./merge-queue.mjs"
import {
  agentHeader,
  designStateFile,
  designStatesRunner,
  failureExcerpt,
  namedDesignState,
  raceTitle,
  recordRace,
} from "./race-issue.mjs"
import { ownedFailure } from "./failure-owners.mjs"
export const browserStep = "browser-tests"

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

export const outsideTheDiff = ({ jobs, files, byMap = false, read }) => {
  if (jobs.length === 0) return { outside: false, why: "no failed job log could be read" }
  for (const job of jobs) {
    const fault = jobFault(job)
    if (fault !== undefined) return { outside: false, why: fault }
  }
  if (files === undefined)
    return {
      outside: false,
      why: "the files this pull request changes could not be read",
    }
  const tests = jobs.flatMap((job) => failedTests(job.log))
  const namedDesign = tests.filter(namedDesignState)
  const designOnly = namedDesign.length > 0 && namedDesign.length === tests.length
  if (designOnly) {
    const owned = namedDesign.find(
      (test) =>
        files.includes(test.file) || files.includes(designStatesRunner) || files.includes(designStateFile(test.state)),
    )
    if (owned !== undefined)
      return {
        outside: false,
        owned: true,
        why: `this pull request changes the failed design state ${owned.state}`,
      }
  } else {
    for (const test of tests) {
      const touched = ownedFailure(test, files, read)
      if (touched !== undefined)
        return {
          outside: false,
          owned: true,
          why: `this pull request changes ${touched}, which the failed test ${test.file} uses`,
        }
    }
  }
  if (byMap) {
    const reaches = jobsReachedBy(files)
    const reached = jobs.find((job) => reaches(job.name))
    if (reached !== undefined)
      return {
        outside: false,
        owned: true,
        why: `the change map says this pull request can affect ${reached.name}`,
      }
  }
  return { outside: true, tests }
}

const lines = (answer) => (answer.status === 0 ? answer.stdout.split("\n").filter((line) => line !== "") : undefined)

export const pullFiles = ({ gh, repository, number }) => {
  const files = lines(
    gh([
      "api",
      "--paginate",
      `repos/${repository}/pulls/${number}/files?per_page=100`,
      "--jq",
      ".[] | .filename, (.previous_filename // empty)",
    ]),
  )
  return files?.length < 3000 ? files : undefined
}

const freshRunState = ({ gh, repository, number, head }) => {
  const answer = gh([
    "api",
    "--paginate",
    `repos/${repository}/issues/${number}/comments?per_page=100`,
    "--jq",
    ".[].body",
  ])
  if (answer.status !== 0) return undefined
  const mark = freshRunMark(head)
  const at = answer.stdout.indexOf(mark)
  if (at === -1) return { used: false }
  const after = /^\s*<!-- fresh-ci-after: (\d+) -->/.exec(answer.stdout.slice(at + mark.length))
  return { used: true, after: after === null ? undefined : Number(after[1]) }
}

const runUrl = (repository, id) => `https://github.com/${repository}/actions/runs/${id}`

export const recordRaces = ({ gh, repository, run, head, tests, jobs, passed }) => {
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
      seen:
        passed === undefined
          ? `in ci run ${runUrl(repository, run.id)}, where the change map rules out the pull request's diff`
          : `in ci run ${runUrl(repository, run.id)}, on a diff that leaves the test alone, and passed in the fresh run ${runUrl(repository, passed)} on the same head`,
    })
    if (kept.why !== undefined) return { why: kept.why }
    urls.push(kept.url)
  }
  return { urls: [...new Set(urls)] }
}

const freshRunReason = ({ byMap, races }) => {
  if (!byMap)
    return "One fresh run on this head will tell. Land records a race only if these tests pass in it, and stops for a fix if they fail again."
  return races.length === 0
    ? "Land records a race only after the failed tests pass in a fresh run on this head."
    : `The red-main bot recorded the races in ${races.join(", ")}.`
}

export const freshRunComment = ({ repository, run, head, tests, queue, races = [], byMap = false }) =>
  [
    agentHeader,
    "",
    `ci failed on head ${head.slice(0, 7)} in ${byMap ? "jobs the change map says this diff cannot reach" : "tests this pull request does not edit"}. ${runUrl(repository, run.id)}`,
    "",
    ...tests.map((test) => `- ${test.line === undefined ? test.file : `${test.file}:${test.line}`}: ${test.name}`),
    "",
    freshRunReason({ byMap, races }),
    "",
    `Taking a fresh ci run with run attempt 1 by ${queue ? "entering the merge queue again" : "closing and reopening the pull request"}. If the fresh run fails, stop for a fix.`,
    "",
    freshRunMark(head),
    `<!-- fresh-ci-after: ${run.id} -->`,
  ].join("\n")

export const freshRunVerdict = ({ gh, repository, number, head, jobs, byMap = false }) => {
  const judged = outsideTheDiff({
    jobs,
    files: pullFiles({ gh, repository, number }),
    byMap,
  })
  if (!judged.outside) return { take: false, owned: judged.owned === true, why: judged.why }
  const state = freshRunState({ gh, repository, number, head })
  if (state === undefined)
    return {
      take: false,
      why: "the pull request's comments could not be read",
    }
  if (state.used)
    return {
      take: false,
      after: state.after,
      why: `the one fresh run for head ${head.slice(0, 7)} is used`,
    }
  return { take: true, tests: judged.tests }
}

const testStep = /^Run pnpm (?:check(?:\s|:(?:pdf|pptx)$)|test:journeys$)/

export const confirmFreshRaces = ({ gh, repository, number, head, runs }) => {
  const after = freshRunState({ gh, repository, number, head })?.after
  if (after === undefined) return {}
  const sameHead = runs().filter((run) => run.head === head)
  const first = sameHead.find((run) => run.id === after && run.attempt === 1)
  const fresh = sameHead.filter((run) => run.id > after).sort((left, right) => left.id - right.id)[0]
  if (first === undefined || fresh?.attempt !== 1) return {}
  const listed = gh([
    "api",
    `repos/${repository}/actions/runs/${fresh.id}/attempts/1/jobs?per_page=100`,
    "--jq",
    ".jobs",
  ])
  if (listed.status !== 0) return { why: "the fresh run's jobs could not be read" }
  const passed = JSON.parse(listed.stdout || "[]").filter((job) => job.conclusion === "success")
  if (!passed.some((job) => job.name === "ci")) return {}
  const read = failedJobLogs({ repository, gh, run: first })
  const tested = new Set(
    passed
      .filter((job) => job.steps?.some((step) => step.conclusion === "success" && testStep.test(step.name)))
      .map((job) => job.name),
  )
  if (read.warnings.length > 0 || !read.jobs.every((job) => tested.has(job.name))) return {}
  const judged = outsideTheDiff({
    jobs: read.jobs,
    files: pullFiles({ gh, repository, number }),
  })
  if (!judged.outside) return {}
  return recordRaces({
    gh,
    repository,
    run: first,
    head,
    tests: judged.tests,
    jobs: read.jobs,
    passed: fresh.id,
  })
}

export const failedTwice = ({ gh, repository, after, jobs }) => {
  const first = failedJobLogs({ repository, gh, run: { id: after } })
  if (first.warnings.length > 0) return []
  const before = new Set(first.jobs.flatMap((job) => failedTests(job.log)).map(raceTitle))
  const again = new Map()
  for (const test of jobs.flatMap((job) => failedTests(job.log)))
    if (before.has(raceTitle(test))) again.set(raceTitle(test), test)
  return [...again.values()]
}

export const reopenPull = ({ gh, number, repository }) => {
  const repo = repository === undefined ? [] : ["--repo", repository]
  const closed = gh(["pr", "close", String(number), ...repo])
  if (closed.status !== 0) return `gh pr close failed: ${closed.stderr.trim()}`
  const reopened = gh(["pr", "reopen", String(number), ...repo])
  if (reopened.status !== 0) return `gh pr reopen failed: ${reopened.stderr.trim()}. Reopen it: gh pr reopen ${number}`
}

export const postFreshRun = ({ gh, repository, number, body }) => {
  const commented = gh(["api", "-X", "POST", `repos/${repository}/issues/${number}/comments`, "-f", `body=${body}`])
  if (commented.status !== 0) return `the comment could not be posted: ${commented.stderr.trim()}`
}

const startLimitMs = 180000

const newerRunStarted = ({ pull, run }) => {
  const failed = pull.runs.find((each) => each.id === run.id)
  return pull.runs.some((each) => each.id > run.id && (failed === undefined || each.workflow === failed.workflow))
}

const awaitNewRun = async ({ read, repository, number, run, head, sleep, now, interval }) => {
  const started = now()
  for (;;) {
    const pull = readPull({ read, repository, number })
    if (pull.head !== head) return undefined
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
  queue,
  sleep,
  now,
  interval,
  comment,
}) => {
  const body = comment ?? freshRunComment({ repository, run, head, tests, queue })
  const fault = postFreshRun({ gh, repository, number, body })
  if (fault !== undefined) return fault
  if (!queue) {
    const fault = reopenPull({ gh, number })
    if (fault !== undefined) return fault
    const started = await awaitNewRun({
      read,
      repository,
      number,
      run,
      head,
      sleep,
      now,
      interval,
    })
    if (started === undefined)
      return `no ci run started within ${startLimitMs / 60000} minutes of the reopen. Look at: gh pr checks ${number}`
    if (!started.hasQueue) return undefined
  }
  const queued = enqueue({ merge: gh, read, repository, number })
  return queued.ok ? undefined : queued.message
}

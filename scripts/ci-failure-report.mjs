import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { failedSteps, failedTests } from "./failed-tests.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { overLimit } from "./metrics.mjs"

const pullListLimit = 100

export const mergedLimit = 20
export const falseStopBudget = 1

const formerStepNames = new Map([
  ["copy-literals", "copy-in-tests"],
  ["browser-imports", "test-imports"],
  ["test", "unit-tests"],
  ["tooling", "script-tests"],
  ["bug-rule", "lint-rules"],
  ["file-size", "file-growth"],
  ["references", "tsconfig-references"],
  ["interface-width", "unused-exports"],
  ["worktrees", "sweep-list"],
  ["stale-tree", "restored-files"],
  ["specs", "model-check"],
  ["spec-replays", "spec-coverage"],
  ["spec-sync", "spec-drift"],
  ["browser", "browser-tests"],
  ["boundaries", "package-boundaries"],
  ["site", "site-build"],
])

const stepClass = (step) => `pnpm check: ${formerStepNames.get(step) ?? step}`

export const failureClass = (log) => {
  const step = /\bfail ([a-z:-]+)(?: [\d.]+s)?$/m.exec(log)
  if (step) return stepClass(step[1])
  if (/\d+ pptx checks failed/.test(log)) return "PowerPoint check: a case failed"
  if (/ is \d+(\.\d+)? and its limit is /.test(log)) return "a timed metric went over its limit"
  const named = /^[^\t\n]*\t([^\t\n]+)\t\d{4}-\d\d-\d\dT/m.exec(log)
  return named ? `other: ${named[1].replace(/[^\w .:/-]/g, "")}` : "the run left no log"
}

export const testClass = (test) => {
  const where = test.line === undefined ? test.file : `${test.file}:${test.line}`
  return `${where} › ${test.name}`.replace(/\|/g, "/")
}

export const classesIn = (log) => {
  const tests = failedTests(log).map(testClass)
  if (tests.length > 0) return tests
  const steps = failedSteps(log).map(stepClass)
  if (steps.length > 0) return steps
  return [failureClass(log)]
}

export const classesOf = (logs) => {
  const named = [...new Set(logs.flatMap((log) => classesIn(log)))].filter((name) => name !== "the run left no log")
  return named.length > 0 ? named : ["the run left no log"]
}

const unreadLog = "the job log could not be read"
const unnamedClasses = new Set(["the run left no log", unreadLog])

export const runClasses = ({ repository, run, gh }) => {
  const { logs, warnings } = failedJobLogs({ repository, run, gh })
  const named = classesOf(logs)
  return { names: named[0] === "the run left no log" && warnings.length > 0 ? [unreadLog] : named, warnings }
}

export const audit = ({ runs, logs }) => {
  const failed = runs.filter((run) => run.conclusion === "failure")
  const classes = new Map()
  for (const run of failed) {
    for (const name of classesOf([logs.get(run.id) ?? ""])) {
      classes.set(name, [...(classes.get(name) ?? []), run.id])
    }
  }
  const unnamed = (entry) => (entry[0] === "the run left no log" ? 1 : 0)
  const ranked = [...classes].sort(
    (left, right) =>
      unnamed(left) - unnamed(right) || right[1].length - left[1].length || left[0].localeCompare(right[0]),
  )
  return {
    total: runs.length,
    failed: failed.length,
    redMain: failed.filter((run) => run.branch === "main").length,
    ranked,
  }
}

const correct = "run `/correct` on this class"

export const rankLosses = (rows) => {
  const classes = new Map()
  for (const row of rows) {
    const current = classes.get(row.name) ?? { name: row.name, count: 0, minutes: 0, runId: row.runId }
    current.count += 1
    current.minutes += row.minutes
    classes.set(row.name, current)
  }
  const unnamed = (row) => (unnamedClasses.has(row.name) ? 1 : 0)
  return [...classes.values()].sort(
    (left, right) =>
      right.minutes - left.minutes ||
      unnamed(left) - unnamed(right) ||
      right.count - left.count ||
      left.name.localeCompare(right.name),
  )
}

export const report = (ranked, repository) => [
  "| Minutes lost | Failures | Class | Example run | |",
  "| --- | --- | --- | --- | --- |",
  ...ranked.map(
    (row) =>
      `| ${row.minutes.toFixed(1)} | ${row.count} | ${row.name} | https://github.com/${repository}/actions/runs/${row.runId} | ${correct} |`,
  ),
  "",
  "Minutes lost add each failed run to the wait until that pull request's next push or re-queue. Take the top class. Find the mistake behind it, and change the repo so it cannot repeat: code first, a check second, a line in AGENTS.md last.",
]

const failedConclusions = new Set(["failure", "timed_out", "startup_failure"])

export const lastMerged = (pulls) =>
  [...pulls].sort((left, right) => right.mergedAt.localeCompare(left.mergedAt)).slice(0, mergedLimit)

const stoppedRuns = (runs) => {
  const ordered = [...runs].sort((left, right) => left.id - right.id || left.attempt - right.attempt)
  return ordered.filter(
    (run, index) =>
      failedConclusions.has(run.conclusion) &&
      ordered.slice(index + 1).some((later) => later.sha === run.sha && later.conclusion === "success"),
  )
}

const headMovedAfter = (runs, queueRun) => {
  const ordered = [...runs].sort((left, right) => left.id - right.id)
  const head = ordered.filter((run) => run.id < queueRun.id).at(-1)
  return ordered.some((run) => run.id > queueRun.id && run.sha !== head?.sha)
}

const droppedRuns = ({ runs, queueRuns = [] }) =>
  queueRuns.filter((run) => failedConclusions.has(run.conclusion) && !headMovedAfter(runs, run))

export const queueNumber = (branch) => Number(/^gh-readonly-queue\/main\/pr-(\d+)-/.exec(branch)?.[1])

export const falseStops = (pulls) => {
  const read = lastMerged(pulls)
  const stops = read
    .map((pull) => {
      const stopped = stoppedRuns(pull.runs)
      const dropped = droppedRuns(pull)
      return { number: pull.number, stopped, dropped, runs: [...stopped, ...dropped] }
    })
    .filter((stop) => stop.runs.length > 0)
  return { read: read.length, count: stops.length, stops }
}

export const stopLine = ({ number, stopped, dropped }) => {
  const parts = [
    ...(stopped.length > 0 ? [`${stopped.length} failed on ${stopped[0].sha.slice(0, 7)}, then passed`] : []),
    ...(dropped.length > 0
      ? [`${dropped.length} dropped from the queue by run ${dropped[0].id}, then merged on the same head`]
      : []),
  ]
  return `- #${number}: ${parts.join("; ")}`
}

export const repeatRebases = (pulls) => {
  const read = lastMerged(pulls)
  const repeats = read
    .map((pull) => ({
      number: pull.number,
      pushes: pull.events.filter((event) => event === "head_ref_force_pushed").length,
    }))
    .filter((repeat) => repeat.pushes > 1)
  return { read: read.length, count: repeats.length, repeats }
}

export const repeatRebaseLines = ({ count, read, repeats }) => [
  `Repeat rebases: ${count} of the last ${read} merged PRs.`,
  ...repeats.map((repeat) => `- #${repeat.number}: ${repeat.pushes} force pushes`),
]

export const falseStopLine = ({ count, read }) =>
  `False stops: ${count} of the last ${read} merged PRs. Budget: ${falseStopBudget}.`

export const countIn = (texts) => {
  const counts = texts.flatMap((text) => /False stops: (\d+) of/.exec(text)?.[1] ?? [])
  return counts.length > 0 ? Number(counts.at(-1)) : undefined
}

export const alarmAction = (count, open) => {
  if (count <= falseStopBudget) return open ? "close" : "none"
  if (!open) return "open"
  return countIn(open.texts) === count ? "none" : "comment"
}

export const attemptId = (run) => `${run.id}/attempts/${run.attempt}`

const responses = new Set(["head_ref_force_pushed", "committed", "added_to_merge_queue"])

const minutesFrom = (start, end) => {
  const span = Date.parse(end) - Date.parse(start)
  return Number.isFinite(span) ? span / 60000 : undefined
}

const held = (minutes) => (minutes === undefined || minutes < 0 ? 0 : minutes)

export const responseAt = (events, after) => {
  const from = Date.parse(after)
  return events
    .filter((event) => responses.has(event.event) && Date.parse(event.at) > from)
    .sort((left, right) => Date.parse(left.at) - Date.parse(right.at))[0]?.at
}

export const lostMinutes = (run, events) => {
  const duration = held(minutesFrom(run.startedAt ?? run.createdAt, run.updatedAt))
  const next = run.updatedAt === undefined ? undefined : responseAt(events, run.updatedAt)
  return duration + (next === undefined ? 0 : held(minutesFrom(run.updatedAt, next)))
}

export const noticeSamples = (events, queueRuns) => {
  const failed = (queueRuns ?? [])
    .filter((run) => failedConclusions.has(run.conclusion) && run.updatedAt)
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
  const removals = events
    .filter((event) => event.event === "removed_from_merge_queue" && event.at)
    .sort((left, right) => left.at.localeCompare(right.at))
  const used = new Set()
  const waits = []
  for (const run of failed) {
    const removal = removals.find((event) => {
      if (used.has(event)) return false
      const delta = minutesFrom(run.updatedAt, event.at)
      return delta !== undefined && delta >= 0 && delta <= 15
    })
    if (removal === undefined) continue
    used.add(removal)
    const next = responseAt(events, removal.at)
    if (next === undefined) continue
    waits.push(held(minutesFrom(removal.at, next)))
  }
  return waits
}

export const mergeMinutes = (pulls) =>
  lastMerged(pulls)
    .map((pull) => minutesFrom(pull.createdAt, pull.mergedAt))
    .filter((minutes) => minutes !== undefined && minutes >= 0)

export const median = (values) => {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const formatMetric = (name, now, limit) => {
  const value = Number((now ?? 0).toFixed(1))
  return {
    line: `metric ${name}  now ${value.toFixed(1)}  limit ${limit}`,
    over: overLimit({ name, now: value, limit }),
  }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const repository = process.argv[2]
  const env = { ...process.env, NO_COLOR: "1" }
  delete env.FORCE_COLOR
  delete env.CLICOLOR
  delete env.CLICOLOR_FORCE
  delete env.GH_FORCE_TTY
  const gh = (args) =>
    execFileSync("gh", args, {
      encoding: "utf8",
      env,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).replace(/\u001b\[[0-9;]*m/g, "")
  const fields =
    "{id, attempt: .run_attempt, sha: .head_sha, conclusion, createdAt: .created_at, startedAt: .run_started_at, updatedAt: .updated_at, branch: .head_branch}"
  const earlierAttempts = (run) =>
    Array.from({ length: run.attempt - 1 }, (_, index) =>
      JSON.parse(gh(["api", `repos/${repository}/actions/runs/${run.id}/attempts/${index + 1}`, "--jq", fields])),
    )
  const runsOf = (pull) =>
    JSON.parse(
      gh([
        "api",
        `repos/${repository}/actions/workflows/ci.yml/runs?event=pull_request&per_page=100&branch=${encodeURIComponent(pull.headRefName)}`,
        "--jq",
        `[.workflow_runs[] | ${fields}]`,
      ]),
    )
      .filter((run) => run.createdAt >= pull.createdAt && run.createdAt <= pull.mergedAt)
      .flatMap((run) => [...earlierAttempts(run), run])
  const merged = JSON.parse(
    gh([
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "merged",
      "--limit",
      String(pullListLimit),
      "--json",
      "number,headRefName,createdAt,mergedAt",
    ]),
  )
  const read = lastMerged(merged)
  const oldest = read.at(-1).createdAt
  const queueRuns = gh([
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?event=merge_group&per_page=100&created=${encodeURIComponent(`>=${oldest}`)}`,
    "--paginate",
    "--jq",
    `.workflow_runs[] | ${fields}`,
  ])
    .split("\n")
    .filter(Boolean)
    .map((text) => JSON.parse(text))
  const timelineOf = (pull) =>
    gh([
      "api",
      `repos/${repository}/issues/${pull.number}/timeline?per_page=100`,
      "--paginate",
      "--jq",
      '.[] | {event: (.event // "committed"), at: (.created_at // .committer.date // .author.date // "")}',
    ])
      .split("\n")
      .filter(Boolean)
      .map((text) => JSON.parse(text))
  const pulls = read.map((pull) => {
    const timeline = timelineOf(pull)
    return {
      ...pull,
      runs: runsOf(pull),
      queueRuns: queueRuns
        .filter(
          (run) =>
            queueNumber(run.branch) === pull.number &&
            run.createdAt >= pull.createdAt &&
            run.createdAt <= pull.mergedAt,
        )
        .flatMap((run) => [...earlierAttempts(run), run]),
      timeline,
      events: timeline.map((event) => event.event),
    }
  })
  const result = falseStops(pulls)
  const jobs = (args) => {
    const done = spawnSync("gh", args, { encoding: "utf8", env, maxBuffer: 256 * 1024 * 1024 })
    return { status: done.status ?? 1, stdout: done.stdout ?? "", stderr: done.stderr ?? "" }
  }
  const losses = pulls.flatMap((pull) =>
    [...pull.runs, ...pull.queueRuns]
      .filter((run) => failedConclusions.has(run.conclusion))
      .flatMap((run) => {
        const { names, warnings } = runClasses({ repository, run, gh: jobs })
        for (const warning of warnings) console.error(`run ${attemptId(run)}: ${warning}`)
        return names.map((name) => ({ name, minutes: lostMinutes(run, pull.timeline), runId: attemptId(run) }))
      }),
  )
  const limits = JSON.parse(fs.readFileSync(path.join(path.dirname(self), "..", "metrics.json"), "utf8"))
  const merge = formatMetric("time-to-merge", median(mergeMinutes(pulls)), limits["time-to-merge"].limit)
  const notice = formatMetric(
    "time-to-notice",
    median(pulls.flatMap((pull) => noticeSamples(pull.timeline, pull.queueRuns))),
    limits["time-to-notice"].limit,
  )
  const line = falseStopLine(result)
  const lines = [
    ...report(rankLosses(losses), repository),
    "",
    merge.line,
    ...(merge.over === undefined ? [] : [merge.over]),
    notice.line,
    ...(notice.over === undefined ? [] : [notice.over]),
    "",
    line,
    "",
    ...result.stops.map(stopLine),
    "",
    ...repeatRebaseLines(repeatRebases(pulls)),
  ]
  for (const metric of [merge, notice]) {
    if (metric.over !== undefined) console.log(`::warning title=${metric.name}::${metric.over}`)
  }
  for (const each of lines) console.log(each)
  if (process.argv[3] === "--issue") {
    const [found] = JSON.parse(
      gh([
        "issue",
        "list",
        "--repo",
        repository,
        "--label",
        "false-stops",
        "--state",
        "open",
        "--json",
        "number,body,comments",
      ]),
    )
    const open = found && {
      number: String(found.number),
      texts: [found.body, ...found.comments.map((comment) => comment.body)],
    }
    const action = alarmAction(result.count, open)
    if (action === "open") {
      gh([
        "label",
        "create",
        "false-stops",
        "--repo",
        repository,
        "--description",
        "ci stopped agents with no code at fault",
        "--color",
        "B60205",
        "--force",
      ])
      gh([
        "issue",
        "create",
        "--repo",
        repository,
        "--title",
        "False stops are over budget",
        "--label",
        "false-stops",
        "--body",
        lines.join("\n"),
      ])
    }
    if (action === "comment") gh(["issue", "comment", open.number, "--repo", repository, "--body", lines.join("\n")])
    if (action === "close") gh(["issue", "close", open.number, "--repo", repository, "--comment", line])
  }
}

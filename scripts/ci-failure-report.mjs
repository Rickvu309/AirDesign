import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const logLimit = 60
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

export const failureClass = (log) => {
  const step = /\bfail ([a-z:-]+)(?: [\d.]+s)?$/m.exec(log)
  if (step) return `pnpm check: ${formerStepNames.get(step[1]) ?? step[1]}`
  if (/\d+ pptx checks failed/.test(log)) return "PowerPoint check: a case failed"
  if (/ is \d+(\.\d+)? and its limit is /.test(log)) return "a timed metric went over its limit"
  const named = /^[^\t]*\t([^\t]+)\t/m.exec(log)
  return named ? `other: ${named[1].replace(/[^\w .:/-]/g, "")}` : "the run left no log"
}

export const audit = ({ runs, logs }) => {
  const failed = runs.filter((run) => run.conclusion === "failure")
  const classes = new Map()
  for (const run of failed) {
    const name = failureClass(logs.get(run.id) ?? "")
    classes.set(name, [...(classes.get(name) ?? []), run.id])
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

export const report = (result, repository) => [
  `Failed runs: ${result.failed}.`,
  "",
  "| Failures | Class | Example run |",
  "| --- | --- | --- |",
  ...result.ranked.map(
    ([name, ids]) => `| ${ids.length} | ${name} | https://github.com/${repository}/actions/runs/${ids[0]} |`,
  ),
  "",
  "Take the top class. Find the mistake behind it, and change the repo so it cannot repeat: code first, a check second, a line in AGENTS.md last.",
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

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const repository = process.argv[2]
  const gh = (args) =>
    execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
  const fields = "{id, attempt: .run_attempt, sha: .head_sha, conclusion, createdAt: .created_at, branch: .head_branch}"
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
  const eventsOf = (pull) =>
    gh(["api", `repos/${repository}/issues/${pull.number}/timeline?per_page=100`, "--paginate", "--jq", ".[] | .event"])
      .split("\n")
      .filter(Boolean)
  const pulls = read.map((pull) => ({
    ...pull,
    runs: runsOf(pull),
    queueRuns: queueRuns
      .filter((run) => queueNumber(run.branch) === pull.number)
      .flatMap((run) => [...earlierAttempts(run), run]),
    events: eventsOf(pull),
  }))
  const result = falseStops(pulls)
  const stopped = result.stops.flatMap((stop) => stop.runs).slice(0, logLimit)
  const logs = new Map()
  for (const run of stopped) {
    try {
      logs.set(
        attemptId(run),
        gh(["run", "view", String(run.id), "--attempt", String(run.attempt), "--repo", repository, "--log-failed"]),
      )
    } catch {
      logs.set(attemptId(run), "")
    }
  }
  const classes = audit({
    runs: stopped.map((run) => ({ id: attemptId(run), conclusion: "failure", branch: "" })),
    logs,
  })
  const line = falseStopLine(result)
  const lines = [
    line,
    "",
    ...result.stops.map(stopLine),
    "",
    ...repeatRebaseLines(repeatRebases(pulls)),
    "",
    ...report(classes, repository),
  ]
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

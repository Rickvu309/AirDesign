import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const days = 7
const logLimit = 60

export const failureClass = (log) => {
  const step = /\bfail ([a-z:-]+)(?: [\d.]+s)?$/m.exec(log)
  if (step) return `pnpm check: ${step[1]}`
  if (/\d+ pptx checks failed/.test(log)) return "PowerPoint check: a case failed"
  if (/ is \d+(\.\d+)? and its limit is /.test(log)) return "a timed stick went over its limit"
  if (/Only \S+ can accept this\./.test(log)) return "owner gate: waiting for the owner"
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
  `Runs in the last ${days} days: ${result.total}. Failed: ${result.failed}. Failed on main: ${result.redMain}.`,
  "",
  "| Failures | Class | Example run |",
  "| --- | --- | --- |",
  ...result.ranked.map(
    ([name, ids]) => `| ${ids.length} | ${name} | https://github.com/${repository}/actions/runs/${ids[0]} |`,
  ),
  "",
  "Take the top class. Find the mistake behind it, and change the repo so it cannot repeat: code first, a check second, a line in AGENTS.md last.",
]

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const repository = process.argv[2]
  const gh = (args) =>
    execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const runsOf = (workflow) =>
    JSON.parse(
      gh([
        "run",
        "list",
        "--workflow",
        workflow,
        "--repo",
        repository,
        "--created",
        `>=${since}`,
        "--limit",
        "1000",
        "--json",
        "databaseId,conclusion,headBranch",
        "--jq",
        "[.[] | {id: .databaseId, conclusion, branch: .headBranch}]",
      ]),
    )
  const listed = (workflow) => {
    try {
      return runsOf(workflow)
    } catch {
      return []
    }
  }
  const runs = [...runsOf("gate"), ...listed("owner gate")]
  const logs = new Map()
  for (const run of runs.filter((each) => each.conclusion === "failure").slice(0, logLimit)) {
    try {
      logs.set(run.id, gh(["run", "view", String(run.id), "--repo", repository, "--log-failed"]))
    } catch {
      logs.set(run.id, "")
    }
  }
  const result = audit({ runs, logs })
  const lines = report(result, repository)
  for (const line of lines) console.log(line)
  if (process.argv[3] === "--issue" && result.failed > 0) {
    gh([
      "issue",
      "create",
      "--repo",
      repository,
      "--title",
      `Failure audit, week to ${new Date().toISOString().slice(0, 10)}`,
      "--body",
      lines.join("\n"),
    ])
  }
}

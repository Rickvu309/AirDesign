import { spawnSync } from "node:child_process"
import path from "node:path"
import { setTimeout as sleepFor } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { queueNumber } from "./ci-failure-report.mjs"
import { ciFailureLines } from "./land-report.mjs"

const logReads = 6
const logReadInterval = 5000

const readJobLog = async ({ repository, job, gh, sleep }) => {
  const endpoint = `repos/${repository}/actions/jobs/${job.id}/logs`
  for (let reads = 1; reads <= logReads; reads += 1) {
    const { status, stdout, stderr } = gh(["api", endpoint])
    if (status === 0 && stdout.trim() !== "") return { log: stdout }
    const http = /\bHTTP \d{3}\b/.exec(stderr)?.[0]
    if (reads === logReads || (status !== 0 && http !== "HTTP 404")) {
      const reason = status === 0 ? "empty response" : (http ?? `gh exited ${status}`)
      return {
        warning: `Could not read the log for job ${job.id} after ${reads} ${reads === 1 ? "read" : "reads"} (${reason}).`,
      }
    }
    await sleep(logReadInterval)
  }
}

const failedJobs = ({ repository, run, gh }) => {
  const result = gh([
    "run",
    "view",
    String(run.id),
    "--repo",
    repository,
    "--json",
    "jobs",
    "--jq",
    '[.jobs[] | select(.conclusion == "failure" and .name != "ci") | {id: .databaseId, name}]',
  ])
  return result.status === 0 ? JSON.parse(result.stdout) : []
}

export const dropComment = async ({ repository, run, gh, git, sleep = sleepFor }) => {
  const number = queueNumber(run.branch)
  if (!Number.isInteger(number)) return undefined
  const jobs = failedJobs({ repository, run, gh })
  const reads = await Promise.all(jobs.map((job) => readJobLog({ repository, job, gh, sleep })))
  const logs = reads.flatMap(({ log }) => (log === undefined ? [] : [log]))
  const warnings = reads.flatMap(({ warning }) => (warning === undefined ? [] : [warning]))
  const body = [
    `The merge queue dropped this pull request: ci failed on its queue run at ${run.sha.slice(0, 7)}. https://github.com/${repository}/actions/runs/${run.id}`,
    "",
    `Failed jobs: ${jobs.length > 0 ? jobs.map((job) => job.name).join(", ") : "none named"}.`,
    "",
    "```text",
    ...warnings,
    ...ciFailureLines({ repository, run, gh, git, logs }),
    "```",
    "",
    "Nothing reran this run or queued the pull request again. It enters the queue again only when someone queues it.",
  ].join("\n")
  return { number, body }
}

const run = (command, root) => (args) => {
  const done = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
  return { status: done.status ?? 1, stdout: done.stdout ?? "", stderr: done.stderr ?? "" }
}

const self = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const root = path.resolve(path.dirname(self), "..")
  const repository = process.argv[2]
  const gh = run("gh", root)
  const queueRun = {
    id: Number(process.env.RUN_ID),
    event: "merge_group",
    branch: process.env.RUN_BRANCH ?? "",
    sha: process.env.RUN_SHA ?? "",
    createdAt: process.env.RUN_CREATED ?? "",
  }
  const comment = await dropComment({ repository, run: queueRun, gh, git: run("git", root) })
  if (comment === undefined) {
    console.log(`${queueRun.branch} names no pull request, so there is nobody to tell.`)
    process.exit(0)
  }
  console.log(comment.body)
  if (process.argv[3] !== "--dry-run") {
    const posted = gh(["pr", "comment", String(comment.number), "--repo", repository, "--body", comment.body])
    if (posted.status !== 0) {
      console.error(posted.stderr)
      process.exitCode = 1
    }
  }
}

import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { queueNumber } from "./ci-failure-report.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { ciFailureLines } from "./land-report.mjs"

const logReads = 6

export const dropComment = ({ repository, run, gh, git, sleep }) => {
  const number = queueNumber(run.branch)
  if (!Number.isInteger(number)) return undefined
  const read = failedJobLogs({ repository, run, gh, reads: logReads, sleep })
  const body = [
    `The merge queue dropped this pull request: ci failed on its queue run at ${run.sha.slice(0, 7)}. https://github.com/${repository}/actions/runs/${run.id}`,
    "",
    `Failed jobs: ${read.jobs.length > 0 ? read.jobs.map((job) => job.name).join(", ") : "none named"}.`,
    "",
    "```text",
    ...ciFailureLines({ repository, run, gh, git, read }),
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
  const comment = dropComment({ repository, run: queueRun, gh, git: run("git", root) })
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

import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { greenRerun, rerunProcess } from "./green-rerun.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { jobFailures } from "./red-main-verdict.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const run = (command) => (args) => {
  const done = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 512 * 2 ** 20 })
  return { status: done.status ?? 1, stdout: done.stdout ?? "", stderr: done.stderr ?? "" }
}

export const drillGreenRerun = ({ repository, id, gh, git, rerun, now = Date.now, say }) => {
  const viewed = gh(["run", "view", String(id), "--repo", repository, "--json", "headSha"])
  if (viewed.status !== 0) return { failed: true, why: `run ${id} could not be read: ${viewed.stderr.trim()}` }
  const red = JSON.parse(viewed.stdout).headSha
  const green = git(["rev-parse", `${red}^`]).stdout.trim()
  const read = failedJobLogs({ repository, run: { id }, gh, reads: 3 })
  const tests = read.jobs.flatMap((job) => jobFailures(job).tests)
  const started = now()
  const outcomes = tests.map((test) => ({ test, ...rerun({ at: green, test }) }))
  for (const { test, result, why } of outcomes)
    say(`${result}: ${test.file} › ${test.name}${why === undefined ? "" : ` (${why})`}`)
  say(
    `green rerun of run ${id}: ${tests.length} failed tests rerun at ${green}, the parent of ${red}, in ${Math.round((now() - started) / 1000)} s`,
  )
  return { failed: tests.length === 0, outcomes }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const say = (line) => console.log(line)
  const result = drillGreenRerun({
    repository: process.env.GITHUB_REPOSITORY,
    id: Number(process.argv[2]),
    gh: run("gh"),
    git: run("git"),
    rerun: greenRerun({ root, run: rerunProcess, say }),
    say,
  })
  if (result.why !== undefined) console.log(result.why)
  if (result.failed) process.exit(1)
}

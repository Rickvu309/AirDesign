import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { jobsReachedBy } from "./change-map.mjs"
import { greenRerun, rerunProcess } from "./green-rerun.mjs"
import { failedJobLogs } from "./job-logs.mjs"
import { judgeRun } from "./red-main-verdict.mjs"

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
  const diff = git(["diff", "--name-only", "--no-renames", green, red])
  const files = diff.status === 0 && diff.stdout.trim() !== "" ? diff.stdout.trim().split("\n") : undefined
  const started = now()
  const outcomes = new Map()
  const rerunTest = (test) => {
    const outcome = rerun({ at: green, test })
    outcomes.set(test, { test, ...outcome })
    return outcome
  }
  const judgment = judgeRun({
    ...read,
    files,
    races: new Set(),
    reaches: jobsReachedBy(files),
    rerun: rerunTest,
  })
  for (const { test, unreachable } of judgment.tests) if (!unreachable && !outcomes.has(test)) rerunTest(test)
  for (const { title, verdict, why } of judgment.tests) say(`${verdict}: ${title.replace(/^Race: /, "")} (${why})`)
  if (judgment.verdict === "race" || judgment.verdict === "old") say(`Verdict: ${judgment.verdict}, no revert`)
  for (const { test, result, why } of outcomes.values())
    say(`${result}: ${test.file} › ${test.name}${why === undefined ? "" : ` (${why})`}`)
  say(
    `green rerun of run ${id}: ${outcomes.size} failed tests rerun at ${green}, the parent of ${red}, in ${Math.round((now() - started) / 1000)} s`,
  )
  return { failed: judgment.tests.length === 0, outcomes: [...outcomes.values()] }
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

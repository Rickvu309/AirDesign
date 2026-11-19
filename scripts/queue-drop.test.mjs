import fs from "node:fs"
import { parse } from "yaml"
import { dropComment } from "./queue-drop.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
const ok = (stdout) => ({ status: 0, stdout, stderr: "" })
const browserJob = (id) => ok(JSON.stringify([{ id, name: "check (browser 4/4)" }]))

const queueRun = {
  id: 43261070421,
  event: "merge_group",
  branch: "gh-readonly-queue/main/pr-645-19e91f75084914dca3801292183decf0304af526",
  sha: "8d1c0b6a2e4f5a7b9c0d1e2f3a4b5c6d7e8f9a0b",
  createdAt: "2026-11-12T16:30:00Z",
}

const asked = []
const gh = (args) => {
  asked.push(args.join(" "))
  if (args[0] === "api" && args[1].endsWith("/jobs/135322156039/logs")) return ok(fixture("job-playwright-failed.log"))
  if (args[0] === "run" && args.includes("jobs")) return browserJob(135322156039)
  if (args[0] === "api" && args[1].endsWith("/artifacts"))
    return ok("test-results-check-browser-3\nbrowser-timings-3\n")
  throw new Error(`unexpected gh ${args.join(" ")}`)
}
const git = (args) => {
  if (args[0] === "cat-file") return ok("")
  if (args[0] === "merge-base") return ok(args[1] + "\n")
  if (args[0] === "rev-list") return ok("0\n")
  throw new Error(`unexpected git ${args.join(" ")}`)
}

const comment = await dropComment({ repository: "Rickvu309/AirDesign", run: queueRun, gh, git })
const lines = comment.body.split("\n")
same("the comment goes to the pull request the queue branch names", comment.number, 645)
same(
  "it opens with the drop and the run link",
  lines[0],
  "The merge queue dropped this pull request: ci failed on its queue run at 8d1c0b6. https://github.com/Rickvu309/AirDesign/actions/runs/43261070421",
)
same("it names the failed job", lines.includes("Failed jobs: check (browser 4/4)."), true)
same("it names the failed step", lines.includes("ci run 43261070421 (merge_group) failed in browser-tests."), true)
same(
  "it names the failed test",
  lines.includes(
    "  tests/browser/save-status.spec.ts:206: an added slide reads Saving while its commit waits and Saved once the server takes it",
  ),
  true,
)
same(
  "it names the kept test results",
  lines.includes(
    "kept test results: test-results-check-browser-3 (gh run download 43261070421 -n test-results-check-browser-3)",
  ),
  true,
)
same(
  "it says a rerun would test the same snapshot when main has not moved",
  lines.includes(
    "main has not moved since this run started. A rerun would test the same snapshot: fix the test or the code.",
  ),
  true,
)
same(
  "it reruns and queues nothing",
  asked.some((call) => /\brerun\b|\bmerge\b/.test(call)),
  false,
)

same(
  "a run on a branch that names no pull request tells nobody",
  await dropComment({ repository: "Rickvu309/AirDesign", run: { ...queueRun, branch: "main" }, gh, git }),
  undefined,
)

const noticeRun = {
  id: 44483186457,
  event: "merge_group",
  branch: "gh-readonly-queue/main/pr-917-2b6758046db318bb21018c6302dddcd1ca2267c4",
  sha: "e36857135aec8e779af33a81589230a2d164b3ca",
  createdAt: "2026-11-19T07:54:09Z",
}
const queueBase = "2b6758046db318bb21018c6302dddcd1ca2267c4"
const previousMain = "b9d4c07e079ad8cb72c8251dab452ca87c31b867"
const missing = { status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)" }
const noticeLog = fixture("job-notice-motion-failed.log")
const noticeComment = async (reads) => {
  let attempts = 0
  const waits = []
  const calls = []
  const result = await dropComment({
    repository: "Rickvu309/AirDesign",
    run: noticeRun,
    sleep: (ms) => waits.push(ms),
    gh: (args) => {
      if (args[1]?.endsWith("/jobs/135420140611/logs")) return reads[attempts++] ?? missing
      if (args[0] === "run") return browserJob(135420140611)
      if (args[1]?.endsWith("/artifacts")) return ok("test-results-check-browser-6\n")
      throw new Error(`unexpected gh ${args.join(" ")}`)
    },
    git: (args) => {
      const command = args.join(" ")
      calls.push(command)
      if (command === `cat-file -e ${queueBase}^{commit}`) return missing
      if (command === `fetch --no-tags --no-write-fetch-head origin ${queueBase}`) return ok("")
      if (command === `merge-base ${queueBase} origin/main`) return ok(previousMain + "\n")
      if (command === `rev-list --count ${previousMain}..origin/main`) return ok("2\n")
      if (command === `diff --name-only ${previousMain} origin/main`) return ok("README.md\n")
      throw new Error(`unexpected git ${command}`)
    },
  })
  return { body: result.body, waits, calls, attempts }
}

const delayed = await noticeComment([missing, ok(""), ok(noticeLog)])
same(
  "the drop names the real failed browser test once the job log becomes available",
  delayed.body.includes(
    "  tests/browser/notice-motion.spec.ts:64: the offline notice slides in and leaves by the top edge",
  ),
  true,
)
same("the drop names the failed step", delayed.body.includes("failed in browser-tests."), true)
same("the drop includes the test error", delayed.body.includes("Error: expect(locator).toBeVisible() failed"), true)
same("the drop waits only for missing and empty logs", [delayed.attempts, delayed.waits.length], [3, 2])
same(
  "the hidden queue commit is fetched",
  delayed.calls.includes(`fetch --no-tags --no-write-fetch-head origin ${queueBase}`),
  true,
)
same(
  "the queued commits are excluded from the count of commits added to main",
  delayed.body.includes("main has moved 2 commits since this run started"),
  true,
)

const unavailable = await noticeComment([])
same("waiting for the job log is bounded", [unavailable.attempts, unavailable.waits.length], [6, 5])
same(
  "the drop identifies a job log GitHub never returned",
  unavailable.body.includes("Could not read the log for job 135420140611 after 6 reads (HTTP 404)."),
  true,
)

const forbidden = await noticeComment([{ status: 1, stdout: "", stderr: "gh: Forbidden (HTTP 403)" }])
same("a forbidden log is reported immediately", [forbidden.attempts, forbidden.waits.length], [1, 0])
same("a forbidden log names the HTTP failure", forbidden.body.includes("after 1 read (HTTP 403)."), true)

const workflow = parse(fs.readFileSync(new URL("../.github/workflows/ci-failure-report.yml", import.meta.url), "utf8"))
const job = workflow.jobs["queue-drop"]
same("the report hears ci runs finish in the merge queue as well as on main", workflow.on.workflow_run.branches, [
  "main",
  "gh-readonly-queue/main/**",
])
same(
  "the drop job runs only when a merge queue run failed",
  job.if,
  "github.event.workflow_run.event == 'merge_group' && github.event.workflow_run.conclusion == 'failure'",
)
same("the drop job may comment on pull requests and nothing more", job.permissions["pull-requests"], "write")
same("the drop job posts the comment and nothing else", job.steps.map((step) => step.run).filter(Boolean), [
  'node scripts/queue-drop.mjs "$GITHUB_REPOSITORY"',
])
same(
  "two drops at once do not replace each other in the concurrency line",
  workflow.concurrency.group.includes("github.event.workflow_run.id"),
  true,
)

console.log("queue-drop tests passed")

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
  if (args[0] === "api" && args[1].endsWith("/jobs?per_page=100")) return ok("135322156039\n")
  if (args[0] === "api" && args[1].endsWith("/jobs/135322156039/logs")) return ok(fixture("job-playwright-failed.log"))
  if (args[0] === "run" && args.includes("jobs")) return ok("check (browser 4/4)\n")
  if (args[0] === "api" && args[1].endsWith("/artifacts"))
    return ok("test-results-check-browser-3\nbrowser-timings-3\n")
  throw new Error(`unexpected gh ${args.join(" ")}`)
}
const git = (args) => {
  if (args[0] === "cat-file") return ok("")
  if (args[0] === "rev-list") return ok("0\n")
  throw new Error(`unexpected git ${args.join(" ")}`)
}

const comment = dropComment({ repository: "Rickvu309/AirDesign", run: queueRun, gh, git })
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
    "  tests/browser/save-status.spec.ts: an added slide reads Saving while its commit waits and Saved once the server takes it",
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
  dropComment({ repository: "Rickvu309/AirDesign", run: { ...queueRun, branch: "main" }, gh, git }),
  undefined,
)

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

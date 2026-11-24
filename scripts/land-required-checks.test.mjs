import fs from "node:fs"
import { parse } from "yaml"
import { takeFreshRun } from "./fresh-run.mjs"
import { fixture, ok, pullAnswer, same } from "./land-harness.mjs"
import { followPull } from "./land-follow.mjs"
import { statusLines } from "./land-status.mjs"
import { awaitChecks, parsePull } from "./merge-queue.mjs"

const replay = JSON.parse(
  fs.readFileSync(
    new URL("./land-fixtures/pull-1049-ci-and-bar-passed-mutation-running.json", import.meta.url),
    "utf8",
  ),
)
const requiredOnMain = replay.refUpdateRule.requiredStatusCheckContexts

const ciWorkflow = 409934807
const codeQlWorkflow = 418799158
const check = (name, state, { required = false, run = 500, workflow = ciWorkflow, id = 0 } = {}) => ({
  __typename: "CheckRun",
  databaseId: id,
  name,
  conclusion: state === "running" ? null : state.toUpperCase(),
  status: state === "running" ? "IN_PROGRESS" : "COMPLETED",
  isRequired: required,
  checkSuite: { workflowRun: { databaseId: run, workflow: { databaseId: workflow } } },
})
const ci = (state, options) => check("ci", state, { required: true, ...options })
const bar = (state, options) => check("bar", state, { required: true, workflow: 414945178, run: 501, ...options })
const mutation = (state, options) => check("mutation", state, options)
const codeQl = (state) => check("Analyze (csharp)", state, { workflow: codeQlWorkflow, run: 502 })

const answer = (contexts, options = {}) =>
  pullAnswer({ queue: false, armed: false, contexts, required: requiredOnMain, ...options })

const ranRuns = (runs) =>
  runs.map((run) => ({ event: "pull_request", branch: "land-command", head: "aaaa1111", ...run }))

const follow = async ({ reads, runs = [], limitMs = 3600000 }) => {
  const said = []
  const asked = []
  const mergedWith = []
  let clock = 0
  let at = 0
  const code = await followPull({
    number: 394,
    branch: "land-command",
    repository: "Rickvu309/AirDesign",
    read: () => reads[Math.min(at++, reads.length - 1)],
    gh: (args) => {
      asked.push(args.join(" "))
      if (args[1]?.endsWith("/jobs?per_page=100")) return ok('[{"id":135322156039,"name":"check (source)"}]')
      if (args[1]?.endsWith("/jobs/135322156039/logs")) return ok(fixture("vitest-failed.log"))
      if (args[1]?.includes("/actions/workflows/ci.yml/runs")) return ok(JSON.stringify(ranRuns(runs)))
      if (args[1]?.endsWith("/artifacts")) return ok("test-results-check-main\n")
      return ok("")
    },
    git: (args) => ({ status: 0, stdout: args[0] === "rev-list" ? "0\n" : "", stderr: "" }),
    sleep: (ms) => {
      clock += ms
    },
    now: () => clock,
    say: (line) => said.push(line),
    interval: 30000,
    graceMs: 120000,
    limitMs,
    merge: async (pull) => {
      mergedWith.push(pull.head)
      return 0
    },
  })
  return { code, said, asked, mergedWith }
}

const replayed = parsePull(answer(replay.contexts))
same(
  "pull request 1049's state reads ci and bar as the required checks",
  [replayed.required.passed, replayed.required.running, replayed.required.failed],
  [["bar", "ci"], [], []],
)
same("and mutation as running and not required", replayed.advisory.running, ["mutation"])

const mergedOnReplay = await follow({ reads: [answer(replay.contexts)] })
same(
  "land merges pull request 1049's state while mutation still runs",
  [mergedOnReplay.code, mergedOnReplay.mergedWith],
  [0, ["aaaa1111"]],
)
same(
  "and says what is still running and that it blocks nothing",
  mergedOnReplay.said.find((line) => line.includes("mutation")),
  "follow: required checks passed (bar, ci); not required, blocks nothing: mutation still running; main has no merge queue; land merges the head itself once ci passes and the recheck passes",
)

const pendingCodeQl = await follow({
  reads: [answer([ci("success"), bar("success"), mutation("running"), codeQl("running")])],
})
same(
  "ci and bar passed with mutation running and CodeQL pending is a merge",
  [pendingCodeQl.code, pendingCodeQl.mergedWith],
  [0, ["aaaa1111"]],
)
same(
  "and both unfinished checks are named as blocking nothing",
  pendingCodeQl.said[0].includes(
    "not required, blocks nothing: Analyze (csharp) still running, mutation still running",
  ),
  true,
)

const waitsForCi = await follow({
  reads: [
    answer([ci("running"), bar("success"), mutation("running"), codeQl("running")]),
    answer([ci("success"), bar("success"), mutation("running"), codeQl("running")]),
  ],
})
same("while ci runs, land waits and then merges", [waitsForCi.code, waitsForCi.mergedWith], [0, ["aaaa1111"]])
same(
  "naming the required check it waits for",
  waitsForCi.said[0].startsWith(
    "follow: required checks are running: ci (1 passed: bar); not required, blocks nothing:",
  ),
  true,
)

const brokenAdvisory = await follow({
  reads: [answer([ci("success"), bar("success"), mutation("failure"), codeQl("failure")])],
})
same(
  "a failed check that is not required neither blocks the merge nor is the failure",
  [brokenAdvisory.code, brokenAdvisory.mergedWith],
  [0, ["aaaa1111"]],
)
same(
  "and it is said as failed, blocking nothing",
  brokenAdvisory.said[0].includes("not required, blocks nothing: Analyze (csharp) failed, mutation failed"),
  true,
)

const noBar = await follow({ reads: [answer([ci("success"), mutation("running")])], limitMs: 120000 })
same("a required check that has not started is waited for, not skipped", [noBar.code, noBar.mergedWith], [1, []])
same("and it is named", noBar.said[0].startsWith("follow: required checks are running: bar (1 passed: ci)"), true)

const nothingRequired = await follow({
  reads: [pullAnswer({ queue: false, contexts: [check("check (source)", "success")], required: [] })],
  limitMs: 120000,
})
same("when GitHub names no required check, land never merges on that", nothingRequired.mergedWith, [])

const ciFailed = await follow({
  reads: [answer([ci("failure"), bar("success"), mutation("success"), codeQl("success")])],
  runs: [{ id: 500, conclusion: "failure", createdAt: "t" }],
})
same("ci failed and mutation passed is the pull request's failure", [ciFailed.code, ciFailed.mergedWith], [1, []])
same(
  "with the failed tests printed",
  ciFailed.said.some((line) => line.includes("agent-commit-race.test.ts")),
  true,
)

const failedBeforeMutationEnds = await follow({
  reads: [answer([ci("failure"), bar("success"), mutation("running")])],
  runs: [{ id: 500, conclusion: null, createdAt: "t" }],
})
same(
  "ci failing while mutation still runs is the failure at once, not after mutation ends",
  [failedBeforeMutationEnds.code, failedBeforeMutationEnds.mergedWith],
  [1, []],
)
same(
  "and the failure is read from the run that is still going",
  failedBeforeMutationEnds.said.some((line) => line.includes("agent-commit-race.test.ts")),
  true,
)

const failedBesideCodeQl = await follow({
  reads: [answer([ci("failure"), bar("success"), codeQl("running")])],
  runs: [{ id: 500, conclusion: null, createdAt: "t" }],
})
same(
  "a check of another workflow that is still running does not hold the failure back",
  [failedBesideCodeQl.code, failedBesideCodeQl.mergedWith],
  [1, []],
)

const barFailed = await follow({
  reads: [answer([ci("success"), bar("failure"), mutation("running")])],
  runs: [{ id: 500, conclusion: null, createdAt: "t" }],
})
same("a required bar that failed stops land while mutation runs", [barFailed.code, barFailed.mergedWith], [1, []])

const reopened = await follow({
  reads: [
    answer([ci("failure", { run: 500 }), bar("success"), mutation("running", { run: 600 })]),
    answer([ci("success", { run: 600 }), bar("success"), mutation("running", { run: 600 })]),
  ],
  runs: [{ id: 600, conclusion: null, createdAt: "t" }],
})
same(
  "a failed ci that a newer run of its workflow replaces is not the failure while that run goes",
  [reopened.code, reopened.mergedWith, reopened.said.some((line) => line.includes("agent-commit-race"))],
  [0, ["aaaa1111"], false],
)

const shown = statusLines({
  number: 394,
  branch: "land-command",
  repository: "Rickvu309/AirDesign",
  pull: replayed,
  git: (args) => ({ status: 0, stdout: args[0] === "rev-list" ? "0\n" : "", stderr: "" }),
  gh: () => ok("[]"),
})
same(
  "land --status tells the required checks from the rest",
  shown.filter((line) => line.startsWith("checks") || line.includes("not required")),
  [
    "checks      required: 2 passed, 0 running, 0 failed",
    "            not required: 23 passed, 1 running, 0 failed (mutation still running)",
  ],
)

const anyCheck = await awaitChecks({
  read: () => answer([mutation("running")]),
  repository: "Rickvu309/AirDesign",
  number: 394,
  sleep: async () => {},
  now: () => 0,
  say: () => {},
})
same("waiting for ci to start counts any check that started", anyCheck.ok, true)

const fresh = async (contexts) => {
  let clock = 0
  const outcome = await takeFreshRun({
    gh: () => ok(""),
    read: () => answer(contexts),
    repository: "Rickvu309/AirDesign",
    number: 394,
    run: { id: 500, event: "pull_request", head: "aaaa1111" },
    head: "aaaa1111",
    tests: [{ file: "tests/browser/a.spec.ts", name: "x" }],
    races: ["https://github.com/Rickvu309/AirDesign/issues/1"],
    queue: false,
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
    interval: 10000,
  })
  return { outcome, clock }
}
const oldRun = [ci("failure", { run: 500 }), bar("success"), mutation("running", { run: 500 })]
const noNewRun = await fresh(oldRun)
same(
  "the old run's mutation still running is not taken for the fresh run starting",
  noNewRun.outcome?.startsWith("no ci run started"),
  true,
)
const newRun = await fresh([...oldRun, check("changes", "running", { run: 601, id: 9 })])
same("a ci run newer than the failed one is the fresh run", newRun.outcome, undefined)

const workflow = parse(fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"))
same("the ci job does not wait for mutation", workflow.jobs.ci.needs.includes("mutation"), false)
same(
  "and no job that gates ci waits for it either",
  [workflow.jobs.check, workflow.jobs.journeys].some((job) => [job.needs].flat().includes("mutation")),
  false,
)
same("mutation never fails the run", workflow.jobs.mutation["continue-on-error"], true)
same(
  "a pull request's run is cancelled only by a newer run of the same pull request, so a merge leaves mutation to finish and report",
  [workflow.concurrency.group, workflow.concurrency["cancel-in-progress"]],
  ["ci-${{ github.event.pull_request.number || github.sha }}", "${{ github.event_name == 'pull_request' }}"],
)
same(
  "mutation runs only on pull requests, so the push run on main never waits for it",
  workflow.jobs.mutation.if,
  "${{ github.event_name == 'pull_request' }}",
)
const revertBot = parse(fs.readFileSync(new URL("../.github/workflows/red-main-revert.yml", import.meta.url), "utf8"))
same(
  "the red-main bot reads ci runs on main and the revert branches, not a pull request's run that land left",
  revertBot.on.workflow_run.branches,
  ["main", "red-main/revert-*"],
)
const closedBranch = fs.readFileSync(new URL("../.github/workflows/closed-branch.yml", import.meta.url), "utf8")
same(
  "only a pull request closed without merging is cleaned up",
  closedBranch.includes("github.event.pull_request.merged == false"),
  true,
)

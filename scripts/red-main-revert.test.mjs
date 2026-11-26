import { attributionLine } from "./commit-authors.mjs"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"
import { bodyFaults } from "./pr-body.mjs"
import {
  culpritBody,
  culpritNumber,
  decideIn,
  failureReads,
  history,
  io,
  logs,
  mainUpTo,
  ok,
  pullOf,
  recorder,
  repository,
  root,
  said,
  same,
  short,
  upTo,
} from "./red-main-replay.mjs"
import { redMainBot, revertBranch } from "./red-main-revert.mjs"
import { revertPull } from "./red-main-revert-report.mjs"
import { decide, judgeRun } from "./red-main-verdict.mjs"
import { titleVerdict } from "./title.mjs"

const [real, insideFlake, flake] = history.windows
const gestureSize =
  "Race: tests/browser/gesture-size.spec.ts › a table resizes by its corner and by Width, scales its columns and rows, and exports at the size kept @export"
const gestureSizeAtLine =
  "Race: tests/browser/gesture-size.spec.ts:82 › a table resizes by its corner and by Width, scales its columns and rows, and exports at the size kept @export"

const first = decideIn(real, "dc8e42a")
same(
  "replay of run 43661138626: dc8e42a added an export spec the corpus job could not run, so the bot reverts dc8e42a",
  [first.action, short(first.target), first.run.id, first.judged.at(-1).tests.map((each) => each.why)],
  ["revert", "dc8e42a", 43661138626, ["the commits it tests change tests/browser/agent-text-box.spec.ts"]],
)
const later = decideIn(real, "9089b2f")
same(
  "every later red run of that streak points at the same first red commit",
  [later.action, short(later.target)],
  ["revert", "dc8e42a"],
)
same("the fix forward at 702c51c turns the streak green", decideIn(real, "702c51c").action, "green")

const second = decideIn(flake, "a56ac0a")
same(
  "replay of run 43778249943: no commit in a93ba32..a56ac0a changes gesture-size.spec.ts, so its failure is a suspect and the revert waits for a second red",
  [
    second.action,
    short(second.target),
    second.judged.at(-1).verdict,
    second.judged.at(-1).tests.map((each) => [each.title, each.why]),
  ],
  [
    "suspect",
    "a93ba32",
    "suspect",
    [
      [
        gestureSize,
        "no commit it tests changes tests/browser/gesture-size.spec.ts, so it reaches the test only through app code",
      ],
    ],
  ],
)
same(
  "a failure in a test with an open Race: issue is that race, even when the issue's title still holds a line number",
  decideIn(flake, "a56ac0a", new Set([gestureSizeAtLine]))
    .judged.at(-1)
    .tests.map((each) => each.why),
  ["an open issue already names this race"],
)
same("the next green run ends that streak", decideIn(flake, "8279e49").action, "green")

const twice = decideIn(flake, "8279e49", new Set([gestureSize]), [
  ...upTo(flake, "a56ac0a"),
  { id: 43778249943, sha: flake.commits.at(-1), status: "completed", conclusion: "failure" },
])
same(
  "the same race failing in the next run too is no flake: the first commit after green is reverted",
  [twice.action, short(twice.target), twice.run.id],
  ["revert", "a93ba32", 43778249943],
)

const inside = decideIn(insideFlake, "6fc7a68")
same(
  "replay of run 43769394689: 6fc7a68 changed gesture-size.spec.ts, so its failure there is its own and it is reverted",
  [inside.action, short(inside.target)],
  ["revert", "6fc7a68"],
)
same("7ed59f2 passing after it makes main green", decideIn(insideFlake, "7ed59f2").action, "green")
const unhandled = decideIn(insideFlake, "34599a4")
same(
  "replay of run 43769961904: vitest's unhandled error names no failed test, so the bot cannot tell and reverts nothing",
  [unhandled.action, unhandled.judged.at(-1).verdict, unhandled.judged.at(-1).why],
  ["hold", "unknown", "check (main): step test names no failed test"],
)

same(
  "a failed check step that is not a test step is real",
  judgeRun({
    jobs: [{ name: "check (source)", log: "fail typecheck 12.0s\nfailed: typecheck\n" }],
    files: [],
    races: new Set(),
  }).verdict,
  "real",
)
same(
  "an unreadable log is unknown, never a revert",
  judgeRun({ jobs: [], warnings: ["Could not list the jobs of run 1 (HTTP 502)."], files: [], races: new Set() }),
  { verdict: "unknown", why: "Could not list the jobs of run 1 (HTTP 502).", tests: [], checks: [] },
)
const typecheck = { name: "check (source)", log: "fail typecheck 12.0s\nfailed: typecheck\n" }
const waiting = decide({
  runs: [
    { id: 1, sha: "a", status: "completed", conclusion: "success" },
    { id: 2, sha: "b", status: "in_progress", conclusion: "" },
    { id: 3, sha: "c", status: "completed", conclusion: "failure" },
  ],
  commits: ["a", "b", "c"],
  jobsOf: () => ({ jobs: [typecheck], warnings: [] }),
  filesBetween: () => [],
  races: new Set(),
})
same("a red run waits while the run before it still runs", [waiting.action, waiting.run.id], ["wait", 2])

const pull = revertPull({
  repository,
  target: first.target,
  title: history.commits[first.target].title,
  number: 499,
  culprit: culpritBody(
    `![Type panel](https://github.com/${repository}/releases/download/proof/type-panel.png)\n\n| main | this PR |`,
  ),
  decision: first,
  failure: ["ci run 43661138626 (push) failed in corpus.", "  tests/browser/agent-text-box.spec.ts:22: an agent"],
  changedFiles: history.commits[first.target].files,
  jobs: logs[43661138626],
})
const bodyLines = pull.body.split("\n")
same("the revert pull request starts with its summary, with no agent line", bodyLines[0], "## Summary")
same(
  "its title quotes the reverted title when that fits the title rule",
  [pull.title, titleVerdict(pull.title)],
  ['Revert "Let a person and an agent set type, spacing and text box layout"', undefined],
)
same(
  "a title too long to quote names the commit",
  revertPull({
    repository,
    target: first.target,
    title: `${history.commits[first.target].title}s`,
    number: 499,
    decision: first,
    failure: [],
    changedFiles: [],
    jobs: [],
  }).title,
  "Revert dc8e42a, which turned main red",
)
for (const words of [
  `from #${culpritNumber}`,
  `https://github.com/${repository}/actions/runs/43661138626`,
  `https://github.com/${repository}/actions/runs/43658393616`,
  "corpus",
  "tests/browser/agent-text-box.spec.ts:22",
  "Error: PostgreSQL 18 was not found.",
  "the commits it tests change tests/browser/agent-text-box.spec.ts",
  `![Type panel](https://github.com/${repository}/releases/download/proof/type-panel.png)`,
]) {
  same(`the body says ${words}`, pull.body.includes(words), true)
}
same(
  "the PowerPoint check's progress lines stay out of the body",
  bodyLines.filter((line) => /^(?:judge|phase) /.test(line)),
  [],
)
same("the excerpt ends before the screenshot attachment", pull.body.includes("attachment #1"), false)
same("the body names the failed job", pull.body.includes("Failed jobs: corpus"), true)
same(
  "the body names a failure by its test, not as a race",
  pull.body.includes("- tests/browser/agent-text-box.spec.ts:22 › an agent sets"),
  true,
)
same(
  "the body passes the bar's body rules",
  bodyFaults(pull.body, { changedFiles: history.commits[first.target].files, repository }),
  [],
)
same(
  "the revert commit names each file it puts back",
  pull.message.split("\n").filter((line) => line.startsWith("Reverts: ")).length,
  history.commits[first.target].files.length,
)
same(
  "a culprit with no visible change keeps that line",
  revertPull({
    repository,
    target: first.target,
    title: "Set type",
    number: 7,
    culprit: culpritBody("No visible change: only the exporter changes."),
    decision: first,
    failure: [],
    changedFiles: ["apps/web/src/design/controls/text.tsx"],
    jobs: logs[43661138626],
  }).body.includes("No visible change: this reverts #7, whose body says: only the exporter changes."),
  true,
)

const opened = recorder([...mainUpTo(real, "dc8e42a"), [/^owner pr list/, () => ok("[]")]])
await redMainBot({
  repository,
  event: { id: 43661138626, event: "push", branch: "main", sha: first.target, conclusion: "failure" },
  io: io(opened),
})
const ownerCalls = opened.calls.filter((call) => call.who === "owner").map((call) => call.args.slice(0, 2).join(" "))
same("the bot opens the revert as the owner, so its checks run", ownerCalls, ["pr list", "pr create"])
same(
  "it pushes the revert branch, never main",
  opened.calls.filter((call) => call.args[0] === "push").map((call) => call.args.at(-1)),
  [`HEAD:refs/heads/${revertBranch(first.target)}`],
)
same(
  "the failure report reads the push run without the PowerPoint check's progress lines",
  [failureReads[0].run.event, failureReads[0].read.jobs.some((job) => /Z (?:judge|phase) /.test(job.log))],
  ["push", false],
)
same(
  "the opened revert names the failed test with its own first error",
  opened.calls
    .find((call) => call.args[1] === "create")
    .input.includes(
      "  tests/browser/agent-text-box.spec.ts:22: an agent sets a text box's autofit, anchor and font, which the person sees and the export keeps @export\n    Error: PostgreSQL 18 was not found.",
    ),
  true,
)
same("it says so on the main is red issue", said.at(-1).includes(revertBranch(first.target)), true)

const again = recorder([
  ...mainUpTo(real, "7fe766e"),
  [/^owner pr list/, () => ok(JSON.stringify([{ number: 1200, state: "OPEN", url: "u" }]))],
])
await redMainBot({
  repository,
  event: { id: 43666350608, event: "push", branch: "main", sha: real.commits[2], conclusion: "failure" },
  io: io(again),
})
same(
  "a second red run opens no second revert",
  again.calls.some((call) => call.args[1] === "create"),
  false,
)

const raced = recorder([
  ...mainUpTo(flake, "a56ac0a"),
  [/^gh issue create/, () => ok("https://github.com/Rickvu309/AirDesign/issues/1300\n")],
])
await redMainBot({
  repository,
  event: { id: 43778249943, event: "push", branch: "main", sha: flake.commits[3], conclusion: "failure" },
  io: io(raced),
})
same(
  "the flaky replay opens the revert of the suspect and records no race yet",
  [
    raced.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "create").length,
    raced.calls.filter((call) => call.who === "owner").map((call) => call.args.slice(0, 2).join(" ")),
  ],
  [0, ["pr list", "pr create"]],
)

const revertRun = (conclusion) => ({
  id: 9,
  event: "pull_request",
  branch: revertBranch(first.target),
  sha: "f".repeat(40),
  conclusion,
})
const stillRed = recorder([...mainUpTo(real, "9089b2f"), pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(stillRed) })
same(
  "a revert whose ci passed while main is still red is merged as the owner",
  stillRed.calls.filter((call) => call.who === "owner").map((call) => call.args.join(" ")),
  [`pr merge 1200 --repo ${repository} --rebase --match-head-commit ${"f".repeat(40)}`],
)
const fixedForward = recorder([...mainUpTo(real, "702c51c"), pullOf])
await redMainBot({ repository, event: revertRun("success"), io: io(fixedForward) })
same(
  "a revert whose ci passed after main went green is closed, not merged",
  fixedForward.calls
    .filter((call) => call.args[0] === "pr" && ["merge", "close"].includes(call.args[1]))
    .map((call) => `${call.who} ${call.args[1]}`),
  ["gh close"],
)
const failedRevert = recorder([...mainUpTo(real, "9089b2f"), pullOf])
await redMainBot({ repository, event: revertRun("failure"), io: io(failedRevert) })
same(
  "a revert whose ci failed is neither merged nor rerun",
  failedRevert.calls.some((call) => ["pr merge", "run rerun"].includes(call.args.slice(0, 2).join(" "))),
  false,
)
const forked = recorder([
  ...mainUpTo(real, "9089b2f"),
  [
    /^gh pr list --repo \S+ --head/,
    () => ok(JSON.stringify([{ number: 1201, headRefOid: "f".repeat(40), isCrossRepository: true }])),
  ],
])
await redMainBot({ repository, event: revertRun("success"), io: io(forked) })
same(
  "a fork's branch with the revert name is never merged",
  forked.calls.some((call) => call.who === "owner"),
  false,
)

const green = recorder([
  ...mainUpTo(real, "702c51c"),
  [
    /^gh pr list --repo \S+ --state open/,
    () => ok(JSON.stringify([{ number: 1200, headRefName: revertBranch(first.target), isCrossRepository: false }])),
  ],
])
await redMainBot({
  repository,
  event: { id: 43676947259, event: "push", branch: "main", sha: real.commits.at(-1), conclusion: "success" },
  io: io(green),
})
same(
  "main going green first closes the open revert",
  green.calls.filter((call) => call.args[0] === "pr" && call.args[1] === "close").map((call) => call.args[2]),
  ["1200"],
)

const noToken = recorder([...mainUpTo(real, "dc8e42a")])
const missing = await redMainBot({
  repository,
  event: { id: 43661138626, event: "push", branch: "main", sha: first.target, conclusion: "failure" },
  io: { ...io(noToken), owner: undefined },
})
same(
  "without the owner's token it opens nothing and fails",
  [noToken.calls.some((call) => call.args[0] === "push"), missing.failed],
  [false, true],
)

const drill = { event: "workflow_dispatch", sha: first.target, id: 9, attempt: 1 }
const drillHead = "f".repeat(40)
const drillBranch = `red-main/drill-${first.target}-9-1`
const drillUrl = `https://github.com/${repository}/pull/1200`
const drillRun = async (status) => {
  const fake = recorder([
    [/^git rev-parse HEAD/, () => ok(drillHead)],
    [/^owner pr create/, () => ok(drillUrl)],
    [
      /^gh run list .*--branch red-main\/drill-/,
      () => ok(JSON.stringify([{ headSha: drillHead, status, url: "run" }])),
    ],
    ...mainUpTo(real, "702c51c"),
  ])
  const result = await redMainBot({ repository, event: drill, io: { ...io(fake), sleep: async () => {} } })
  return { result, calls: fake.calls }
}
const drilled = await drillRun("in_progress")
const drillBody = drilled.calls.find((call) => call.who === "owner" && call.args[1] === "create")?.input ?? ""
same(
  "the drill opens the bot's marked PR as the owner",
  [
    drilled.result.failed,
    attributionLine(drillBody) === undefined,
    drillBody.includes("Drill:"),
    bodyFaults(drillBody, { repository }),
  ],
  [false, true, true, []],
)
same(
  "ci and bar start before close and delete",
  drilled.calls
    .filter(({ args }) => args.includes(drillBranch) || args[1] === "close")
    .map(({ args }) =>
      args.includes("--workflow") ? args[args.indexOf("--workflow") + 1] : args.slice(0, 2).join(" "),
    ),
  ["pr list", "checkout -B", "pr create", "ci.yml", "bar.yml", "pr close", "push origin"],
)
same("the drill records its cleanup on the red-main issue", said.at(-1).includes(`Deleted branch ${drillBranch}`), true)
same(
  "a drill branch cannot be followed into a merge",
  (await redMainBot({ repository, event: { ...revertRun("success"), branch: drillBranch }, io: {} })).said,
  ["not a revert branch"],
)
same(
  "a SHA outside main cannot be drilled",
  (await redMainBot({ repository, event: { ...drill, sha: drillHead }, io: recorder(mainUpTo(real, "702c51c")) }))
    .failed,
  true,
)
const timedOut = await drillRun("queued")
same(
  "a drill with unstarted checks fails and cleans up",
  [
    timedOut.result.failed,
    timedOut.calls.some(({ args }) => args[1] === "close"),
    timedOut.calls.some(({ args }) => args.includes("--delete")),
  ],
  [true, true, true],
)

const workflow = parse(fs.readFileSync(path.join(root, ".github/workflows/red-main-revert.yml"), "utf8"))
same("a dispatch names a drill SHA or a red run to rerun", Object.keys(workflow.on.workflow_dispatch?.inputs ?? {}), [
  "drill_sha",
  "rerun_run",
])
same(
  "a drill reverts only from main, and only with a drill SHA",
  workflow.jobs["red-main-revert"].if.includes("github.ref == 'refs/heads/main' && inputs.drill_sha != ''"),
  true,
)
const rerunDrill = workflow.jobs["green-rerun-drill"]
same(
  "the green rerun drill gets no secret and no write permission, so any branch may dispatch it",
  [JSON.stringify(rerunDrill).includes("secrets."), rerunDrill.permissions, rerunDrill.steps.at(-1).run],
  [false, { actions: "read", contents: "read" }, 'node scripts/green-rerun-drill.mjs "$RERUN_RUN"'],
)
same("the bot runs when ci completes on main or on a revert branch", workflow.on.workflow_run, {
  workflows: ["ci"],
  types: ["completed"],
  branches: ["main", "red-main/revert-*"],
})
same("the workflow token gets only what the bot needs", workflow.permissions, {
  actions: "read",
  contents: "read",
  issues: "write",
  "pull-requests": "write",
})
const steps = workflow.jobs["red-main-revert"].steps
same(
  "the bot sets up Node, pnpm and Postgres for a green rerun",
  steps
    .filter((step) => step.uses !== undefined && !step.uses.startsWith("actions/checkout"))
    .map((step) => step.uses.split("@")[0]),
  ["pnpm/action-setup", "actions/setup-node", "./.github/actions/postgres"],
)
same(
  "it checks out main, never the code of a pull request",
  steps.filter((step) => step.uses?.startsWith("actions/checkout")).map((step) => step.with?.ref),
  [undefined],
)
same(
  "the owner's token reaches only the bot's step",
  steps.filter((step) => JSON.stringify(step).includes("secrets.")).map((step) => step.run),
  ["node scripts/red-main-revert.mjs"],
)
same("drill runs have their own group, and real revert runs still serialize", workflow.concurrency, {
  group:
    "${{ github.event_name == 'workflow_dispatch' && format('red-main-drill-{0}', github.run_id) || 'red-main-revert' }}",
  "cancel-in-progress": false,
})

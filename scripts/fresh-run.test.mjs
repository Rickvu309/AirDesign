import { failedTests } from "./failed-tests.mjs"
import { history, logs } from "./red-main-replay.mjs"
import { freshRunMark, outsideTheDiff } from "./fresh-run.mjs"
import { followPull } from "./land-follow.mjs"
import { fixture, mainRules, ok, same } from "./land-harness.mjs"
import { forceTheGap } from "./race-issue.mjs"

const browserLog = fixture("job-playwright-failed.log")
const unitLog = fixture("vitest-failed.log")
const journeysLog = [
  "2026-11-19T03:47:39.6828988Z   1) tests/journeys/journeys.spec.ts:12:1 › a person imports a deck and exports it ",
  "2026-11-19T03:47:39.6830673Z     Error: expect(locator).toBeVisible() failed",
].join("\n")
const browserJob = { name: "check (browser 2/4)", log: browserLog }

same(
  "a change to app code reaches a browser job even when it leaves the failed file alone",
  outsideTheDiff({ jobs: [browserJob], files: ["apps/web/src/editor/save.ts"] }).outside,
  false,
)
same(
  "a journeys job is outside the diff without a failed: line",
  outsideTheDiff({ jobs: [browserJob, { name: "journeys / journeys", log: journeysLog }], files: [] }).outside,
  true,
)
same(
  "a unit-tests step is not a browser step",
  outsideTheDiff({ jobs: [{ name: "check (source)", log: unitLog }], files: [] }).why,
  "step unit-tests failed, and it is not a browser or journeys step",
)
same(
  "a diff that changes the failed test file is inside",
  outsideTheDiff({ jobs: [browserJob], files: ["tests/browser/save-status.spec.ts"] }).outside,
  false,
)
same(
  "a diff that touches any browser test is inside",
  outsideTheDiff({ jobs: [browserJob], files: ["tests/browser/fixtures.ts"] }).why,
  "this pull request changes tests/browser/fixtures.ts",
)
same(
  "a rule file beside a browser test is a doc, so the failure stays outside the diff",
  outsideTheDiff({ jobs: [browserJob], files: ["tests/browser/context-pool.rule.md"] }).outside,
  true,
)
same(
  "a job that names no failed test is unsure, so inside",
  outsideTheDiff({ jobs: [{ name: "corpus", log: "failed: browser-tests\n" }], files: [] }).outside,
  false,
)
same("unread files are unsure, so inside", outsideTheDiff({ jobs: [browserJob], files: undefined }).outside, false)
same("no failed job read is unsure, so inside", outsideTheDiff({ jobs: [], files: [] }).outside, false)

const head = "aaaa1111"
const suite = (run) => ({ workflowRun: { databaseId: run, workflow: { databaseId: 409934807 } } })
const failed = [
  {
    __typename: "CheckRun",
    databaseId: 1,
    name: "ci",
    conclusion: "FAILURE",
    status: "COMPLETED",
    checkSuite: suite(77),
  },
]
const fresh = [
  { __typename: "CheckRun", databaseId: 2, name: "changes", conclusion: null, status: "QUEUED", checkSuite: suite(78) },
]
const passed = [{ ...failed[0], databaseId: 3, conclusion: "SUCCESS", checkSuite: suite(78) }]
const pullAnswer = ({
  contexts = failed,
  state = "OPEN",
  merged = false,
  armed = true,
  entry = null,
  removal,
  queue = true,
} = {}) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          state: merged ? "MERGED" : state,
          merged,
          baseRefName: "main",
          headRefOid: head,
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          isInMergeQueue: entry !== null,
          mergeQueueEntry: entry,
          autoMergeRequest: armed ? { enabledAt: "x", mergeMethod: "REBASE" } : null,
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "FAILURE", contexts: { nodes: contexts } } } }] },
          timelineItems: {
            nodes:
              removal === undefined
                ? []
                : [{ __typename: "RemovedFromMergeQueueEvent", reason: removal, createdAt: "t" }],
          },
        },
        mergeQueue: queue ? { entries: { nodes: [] } } : null,
        ref: mainRules(queue),
      },
    },
  })

const prRun = { id: 77, event: "pull_request", branch: "fix", head, attempt: 1, conclusion: "failure", createdAt: "t" }
const freshRun = { ...prRun, id: 78, conclusion: "success" }
const queueRun = { ...prRun, id: 78, event: "merge_group", branch: `gh-readonly-queue/main/pr-394-${"b".repeat(40)}` }

const follow = async ({
  reads,
  comments = "",
  files = "README.md\n",
  job = browserJob,
  runs = [prRun],
  issues = ok("[]"),
  freshJobs = [
    { name: "ci", conclusion: "success" },
    {
      name: browserJob.name,
      conclusion: "success",
      steps: [{ name: "Run pnpm check --part=browser --shard=2/4", conclusion: "success" }],
    },
  ],
}) => {
  const asked = []
  const said = []
  const raised = []
  let at = 0
  let clock = 0
  const code = await followPull({
    number: 394,
    branch: "fix",
    repository: "Rickvu309/AirDesign",
    read: () => reads[Math.min(at++, reads.length - 1)],
    gh: (args, input) => {
      const call = args.join(" ")
      asked.push(call)
      if (call.startsWith("issue list")) return issues
      if (call.startsWith("api graphql")) return ok(JSON.stringify({ data: { search: { nodes: [] } } }))
      if (call.startsWith("issue create")) {
        raised.push({ title: args[args.indexOf("--title") + 1], body: input })
        return ok("https://github.com/Rickvu309/AirDesign/issues/990\n")
      }
      if (call.includes("/actions/workflows/ci.yml/runs")) return ok(JSON.stringify(runs))
      if (call.includes("/runs/78/attempts/1/jobs") && call.endsWith(".jobs")) return ok(JSON.stringify(freshJobs))
      if (call.includes("/jobs?per_page=100")) return ok(JSON.stringify([{ id: 5, name: job.name }]))
      if (call.includes("/jobs/5/logs")) return ok(job.log)
      if (call.includes("/pulls/394/files")) return ok(files)
      if (call.includes("/issues/394/comments")) {
        if (!call.includes("POST")) return ok(comments)
        comments += `\n${args.at(-1).slice(5)}\n`
      }
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
    limitMs: 3600000,
    merge: () => 0,
  })
  const posted = asked.filter((call) => call.startsWith("api -X POST repos/Rickvu309/AirDesign/issues/394/comments"))
  return { code, said, asked, posted, raised }
}

const reopened = [
  pullAnswer({ queue: false, armed: false }),
  pullAnswer({ queue: false, armed: false, contexts: [...failed, ...fresh] }),
  pullAnswer({ queue: false, armed: false, contexts: passed }),
]
const taken = await follow({ reads: reopened, runs: [freshRun, prRun] })
same("a failure outside the diff takes its fresh run and merges", taken.code, 0)
same("one comment is posted", taken.posted.length, 1)
same(
  "the comment speaks for the owner, names the failed test and marks the head",
  [
    taken.posted[0].includes("body=🤖 **AI Agent responding on behalf of Quan Vu**"),
    taken.posted[0].includes("tests/browser/save-status.spec.ts:206"),
    taken.posted[0].includes(freshRunMark(head)),
  ],
  [true, true, true],
)
same(
  "after a passing fresh run, the issue names both runs, the head and the failure output",
  taken.raised.map((issue) => [
    issue.title,
    issue.body.includes("https://github.com/Rickvu309/AirDesign/actions/runs/77"),
    issue.body.includes("https://github.com/Rickvu309/AirDesign/actions/runs/78"),
    issue.body.includes(head),
    issue.body.includes('Received: "Saved"'),
  ]),
  [
    [
      "Race: tests/browser/save-status.spec.ts › an added slide reads Saving while its commit waits and Saved once the server takes it",
      true,
      true,
      true,
      true,
    ],
  ],
)
same(
  "the issue is opened only after the pull request reopens and fresh ci passes",
  taken.asked.findIndex((call) => call.startsWith("issue create")) >
    taken.asked.findIndex((call) => call.startsWith("pr reopen")),
  true,
)
const unrecorded = await follow({
  reads: reopened,
  runs: [freshRun, prRun],
  issues: { status: 1, stdout: "", stderr: "HTTP 503" },
})
same(
  "a race that cannot be recorded after the fresh run stops land",
  [unrecorded.code, unrecorded.posted.length],
  [1, 1],
)
same(
  "and says why",
  unrecorded.said.some((line) => line.includes("could not record the race") && line.includes("HTTP 503")),
  true,
)
same(
  "the pull request is closed and reopened once",
  taken.asked.filter((call) => /^pr (close|reopen|merge)|^run rerun|\/rerun/.test(call)),
  ["pr close 394", "pr reopen 394"],
)

const skipped = await follow({
  reads: reopened,
  runs: [freshRun, prRun],
  freshJobs: [{ name: "ci", conclusion: "success" }],
})
same("a green ci that skipped the failed job does not establish a race", [skipped.code, skipped.raised], [0, []])
const failedAgain = await follow({
  reads: [
    ...reopened.slice(0, 2),
    pullAnswer({
      queue: false,
      armed: false,
      contexts: [{ ...failed[0], databaseId: 3, checkSuite: suite(78) }],
    }),
  ],
  runs: [prRun],
})
same(
  "a second failure stops and records no race",
  [failedAgain.code, failedAgain.raised, failedAgain.posted.length],
  [1, [], 1],
)
const wrongHead = await follow({ reads: reopened, runs: [{ ...freshRun, head: "bbbb2222" }, prRun] })
same("a green run on another head cannot establish a race", wrongHead.raised, [])

const second = await follow({ reads: [pullAnswer()], comments: `${freshRunMark(head)}\n` })
same("a second fresh run on the same head is refused", second.code, 1)
same("and posts nothing", second.posted.length, 0)
same("and says why", second.said.includes("follow: no fresh run: the one fresh run for head aaaa111 is used."), true)

const inside = await follow({ reads: [pullAnswer()], files: "tests/browser/save-status.spec.ts\n" })
same("a failure inside the diff is refused", [inside.code, inside.posted.length], [1, 0])
same("and opens no issue, since the pull request owns the race", inside.raised, [])
same(
  "and says to force the gap",
  inside.said.some((line) => line.includes(forceTheGap)),
  true,
)

const unit = await follow({ reads: [pullAnswer()], job: { name: "check (source)", log: unitLog } })
same("a step that is not a browser step is refused", [unit.code, unit.posted.length], [1, 0])
same(
  "and nothing is closed",
  unit.asked.some((call) => call.startsWith("pr close")),
  false,
)

const running = await follow({
  reads: [pullAnswer({ contexts: [...failed, { ...fresh[0], name: "check (source)" }] }), pullAnswer({ merged: true })],
})
same("a failed check waits for the rest of the run before it judges", [running.code, running.posted.length], [0, 0])

const queued = { position: 1, state: "QUEUED" }
const requeued = await follow({
  reads: [
    pullAnswer({ entry: queued, contexts: [] }),
    pullAnswer({ armed: false, contexts: [], removal: "failed_checks" }),
    pullAnswer({ armed: false, contexts: [], removal: "failed_checks" }),
    pullAnswer({ entry: queued, contexts: [] }),
    pullAnswer({ merged: true }),
  ],
  runs: [queueRun],
})
same("a queue drop outside the diff is queued once more and merges", requeued.code, 0)
same(
  "with one comment, and no close",
  [requeued.posted.length, requeued.asked.some((call) => call.startsWith("pr close"))],
  [1, false],
)

const conflicted = await follow({
  reads: [
    pullAnswer({ entry: queued, contexts: [] }),
    pullAnswer({ armed: false, contexts: [], removal: "merge_conflict" }),
    pullAnswer({ armed: false, contexts: [], removal: "merge_conflict" }),
  ],
  runs: [queueRun],
})
same("a queue drop for another reason is not queued again", [conflicted.code, conflicted.posted.length], [1, 0])

console.log("fresh-run tests passed")

const unqueued = await follow({
  reads: [
    pullAnswer({ queue: false, armed: false }),
    pullAnswer({ queue: false, armed: false, contexts: [...failed, ...fresh] }),
    pullAnswer({ queue: false, merged: true }),
  ],
})
same("with no merge queue, a failure outside the diff still takes its fresh run", unqueued.code, 0)
same(
  "the pull request is closed and reopened, and auto-merge is not armed, since with no queue it would merge without the recheck",
  unqueued.asked.filter((call) => /^pr (close|reopen|merge)|^run rerun|\/rerun/.test(call)),
  ["pr close 394", "pr reopen 394"],
)

const agentRead = "bb45f06d944ab3f17c42637b701939415b73a561"
const brokenReads = logs[44895953428]
same(
  "run 44895953428: the agent read change can reach all six failed browser and journeys tests, even though their files are untouched",
  [
    brokenReads.flatMap(({ log }) => failedTests(log)).length,
    outsideTheDiff({ jobs: brokenReads, files: history.commits[agentRead].files }).outside,
  ],
  [6, false],
)
const agentReadRun = await follow({
  reads: [pullAnswer({ queue: false, armed: false })],
  files: history.commits[agentRead].files.join("\n"),
})
same(
  "an app-code pull request takes no fresh run or race issue for a browser job it can affect",
  [agentReadRun.code, agentReadRun.posted.length, agentReadRun.raised],
  [1, 0, []],
)

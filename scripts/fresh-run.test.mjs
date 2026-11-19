import { freshRunMark, outsideTheDiff } from "./fresh-run.mjs"
import { followPull } from "./land-follow.mjs"
import { fixture, ok, same } from "./land-harness.mjs"

const browserLog = fixture("job-playwright-failed.log")
const unitLog = fixture("vitest-failed.log")
const journeysLog = [
  "2026-11-19T03:47:39.6828988Z   1) tests/journeys/journeys.spec.ts:12:1 › a person imports a deck and exports it ",
  "2026-11-19T03:47:39.6830673Z     Error: expect(locator).toBeVisible() failed",
].join("\n")
const browserJob = { name: "check (browser 2/4)", log: browserLog }

same(
  "a browser step failing on a test the diff leaves alone is outside the diff",
  outsideTheDiff({ jobs: [browserJob], files: ["apps/web/src/editor/save.ts"] }).outside,
  true,
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
  "a job that names no failed test is unsure, so inside",
  outsideTheDiff({ jobs: [{ name: "corpus", log: "failed: browser-tests\n" }], files: [] }).outside,
  false,
)
same("unread files are unsure, so inside", outsideTheDiff({ jobs: [browserJob], files: undefined }).outside, false)
same("no failed job read is unsure, so inside", outsideTheDiff({ jobs: [], files: [] }).outside, false)

const head = "aaaa1111"
const failed = [
  { __typename: "CheckRun", databaseId: 1, name: "check (browser 2/4)", conclusion: "FAILURE", status: "COMPLETED" },
]
const fresh = [
  { __typename: "CheckRun", databaseId: 2, name: "check (browser 2/4)", conclusion: null, status: "QUEUED" },
]
const pullAnswer = ({ contexts = failed, state = "OPEN", merged = false, armed = true, entry = null, removal } = {}) =>
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
        mergeQueue: { entries: { nodes: [] } },
      },
    },
  })

const prRun = { id: 77, event: "pull_request", branch: "fix", head, conclusion: "failure", createdAt: "t" }
const queueRun = { ...prRun, id: 78, event: "merge_group", branch: `gh-readonly-queue/main/pr-394-${"b".repeat(40)}` }

const follow = async ({
  reads,
  comments = "",
  files = "apps/web/src/editor/save.ts\n",
  job = browserJob,
  runs = [prRun],
}) => {
  const asked = []
  const said = []
  let at = 0
  let clock = 0
  const code = await followPull({
    number: 394,
    branch: "fix",
    repository: "Rickvu309/AirDesign",
    read: () => reads[Math.min(at++, reads.length - 1)],
    gh: (args) => {
      const call = args.join(" ")
      asked.push(call)
      if (call.includes("/actions/workflows/ci.yml/runs")) return ok(JSON.stringify(runs))
      if (call.includes("/jobs?per_page=100")) return ok(JSON.stringify([{ id: 5, name: job.name }]))
      if (call.includes("/jobs/5/logs")) return ok(job.log)
      if (call.includes("/pulls/394/files")) return ok(files)
      if (call.includes("/issues/394/comments") && !call.includes("POST")) return ok(comments)
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
  })
  const posted = asked.filter((call) => call.startsWith("api -X POST repos/Rickvu309/AirDesign/issues/394/comments"))
  return { code, said, asked, posted }
}

const taken = await follow({
  reads: [pullAnswer(), pullAnswer({ armed: false, contexts: [...failed, ...fresh] }), pullAnswer({ merged: true })],
})
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
  "the pull request is closed, reopened and armed again, never rerun",
  taken.asked.filter((call) => /^pr (close|reopen|merge)|^run rerun|\/rerun/.test(call)),
  ["pr close 394", "pr reopen 394", "pr merge 394 --auto --rebase"],
)

const second = await follow({ reads: [pullAnswer()], comments: `${freshRunMark(head)}\n` })
same("a second fresh run on the same head is refused", second.code, 1)
same("and posts nothing", second.posted.length, 0)
same("and says why", second.said.includes("follow: no fresh run: the one fresh run for head aaaa111 is used."), true)

const inside = await follow({ reads: [pullAnswer()], files: "tests/browser/save-status.spec.ts\n" })
same("a failure inside the diff is refused", [inside.code, inside.posted.length], [1, 0])

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

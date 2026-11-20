import { fixture, mainRules, ok, same } from "./land-harness.mjs"
import { followPull } from "./land-follow.mjs"

const repository = "Rickvu309/AirDesign"
const passed = [{ __typename: "CheckRun", name: "check (side)", conclusion: "SUCCESS", status: "COMPLETED" }]
const running = [{ __typename: "CheckRun", name: "check (side)", conclusion: null, status: "IN_PROGRESS" }]
const failed = [{ __typename: "CheckRun", name: "check (side)", conclusion: "FAILURE", status: "COMPLETED" }]

const answer = ({ contexts = passed, merged = false, entry = null, armed = true, timeline = [], state } = {}) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          state: state ?? (merged ? "MERGED" : "OPEN"),
          merged,
          baseRefName: "main",
          headRefOid: "755f8c0f8ef93e7360e7d7c3d4084f6fdd99e492",
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          isInMergeQueue: entry !== null,
          mergeQueueEntry: entry,
          autoMergeRequest: armed ? { enabledAt: "x", mergeMethod: "REBASE" } : null,
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: contexts } } } }] },
          timelineItems: { nodes: timeline },
        },
        mergeQueue: { entries: { nodes: [] } },
        ref: mainRules(),
      },
    },
  })

const redMain = {
  id: 43642103096,
  event: "push",
  branch: "main",
  head: "6a8db92839861a99e9dc6741b1e75f0760609419",
  conclusion: "failure",
  createdAt: "2026-11-14T21:18:23Z",
  title: "Let a person and an agent style lines and arrowheads",
}
const greenBefore = {
  ...redMain,
  id: 43637141626,
  head: "796b2454e".padEnd(40, "0"),
  conclusion: "success",
  createdAt: "2026-11-14T20:22:21Z",
  title: "Move slide backgrounds",
}
const healed = {
  ...redMain,
  id: 43649053245,
  head: "2abaf2563".padEnd(40, "0"),
  conclusion: "success",
  createdAt: "2026-11-14T22:37:18Z",
  title: "Paint a second undo",
}

const follow = async ({ reads, prRun, prLog, mainPolls, files = [] }) => {
  const said = []
  const asked = []
  const comments = []
  let clock = 0
  let at = 0
  let poll = 0
  const code = await followPull({
    number: 394,
    branch: "t3/shape-transform-controls",
    repository,
    read: () => reads[Math.min(at++, reads.length - 1)],
    gh: (args) => {
      asked.push(args.join(" "))
      if (args[0] === "pr" && args[1] === "list") return ok("[]")
      if (args[0] === "pr") return ok("")
      const path = args.find((word) => word.startsWith("repos/"))
      if (path.includes("ci.yml/runs?branch=main&event=push"))
        return ok(JSON.stringify(mainPolls[Math.min(poll++, mainPolls.length - 1)]))
      if (path.includes("ci.yml/runs?event=")) return ok(JSON.stringify([prRun]))
      if (path === `repos/${repository}/actions/runs/${prRun.id}/jobs?per_page=100`)
        return ok(JSON.stringify([{ id: 132594787151, name: "check (side)" }]))
      if (path === `repos/${repository}/actions/jobs/132594787151/logs`) return ok(fixture(prLog))
      if (path === `repos/${repository}/actions/runs/${redMain.id}/jobs?per_page=100`)
        return ok(JSON.stringify([{ id: 132591711136, name: "check (side)" }]))
      if (path === `repos/${repository}/actions/jobs/132591711136/logs`) return ok(fixture("main-red-line-style.log"))
      if (path.endsWith("/artifacts")) return ok("")
      if (path.includes("/pulls/394/files")) return ok(files.join("\n"))
      if (path.includes("/issues/394/comments") && args.includes("POST")) {
        comments.push(args.find((word) => word.startsWith("body=")))
        return ok("{}")
      }
      if (path.includes("/issues/394/comments")) return ok("")
      if (path.startsWith("repos/") && path.includes("/commits?sha=main")) return ok(`${redMain.head}\n`)
      throw new Error(`unexpected gh ${args.join(" ")}`)
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
  return { code, said, asked, comments }
}

const prRun = {
  id: 43643100126,
  event: "pull_request",
  branch: "t3/shape-transform-controls",
  head: "755f8c0f8ef93e7360e7d7c3d4084f6fdd99e492",
  conclusion: "failure",
  createdAt: "2026-11-14T21:29:44Z",
}

const blameless = await follow({
  reads: [answer({ contexts: failed }), answer({ contexts: running }), answer({ merged: true })],
  prRun,
  prLog: "pr-same-as-main.log",
  mainPolls: [
    [redMain, greenBefore],
    [redMain, greenBefore],
    [healed, redMain, greenBefore],
  ],
})
same("a pull request run that failed only on main's failure waits, then lands", blameless.code, 0)
same(
  "land says main is red, since which commit, not this change",
  blameless.said.includes(
    "follow: main is red since 6a8db928 (Let a person and an agent style lines and arrowheads), not your change: check (side)",
  ),
  true,
)
same(
  "it never tells the agent to fix main's error in its own pull request",
  blameless.said.some((line) => /fix the (test|code)|Fix the failure/.test(line)),
  false,
)
same(
  "once main is green it takes a run on that main by closing and reopening, never a rerun",
  [
    blameless.asked.some((line) => line === "pr close 394"),
    blameless.asked.some((line) => line === "pr reopen 394"),
    blameless.asked.some((line) => /^run rerun|\/rerun/.test(line)),
  ],
  [true, true, false],
)
same(
  "and the comment on the pull request is the record of why",
  blameless.comments.length === 1 &&
    blameless.comments[0].includes("6a8db92") &&
    blameless.comments[0].includes("2abaf25"),
  true,
)

const removal = { __typename: "RemovedFromMergeQueueEvent", reason: "failed_checks", createdAt: "2026-11-14T21:45:00Z" }
const queueRun = {
  ...prRun,
  event: "merge_group",
  branch: "gh-readonly-queue/main/pr-394-6a8db92839861a99e9dc6741b1e75f0760609419",
}
const dropped = await follow({
  reads: [
    answer({ entry: { position: 1, state: "QUEUED" } }),
    answer({ armed: false, timeline: [{ __typename: "PullRequestCommit" }, removal] }),
    answer({ armed: false, timeline: [{ __typename: "PullRequestCommit" }, removal] }),
    answer({ entry: { position: 1, state: "QUEUED" } }),
    answer({ entry: { position: 1, state: "QUEUED" } }),
    answer({ merged: true }),
  ],
  prRun: queueRun,
  prLog: "pr-same-as-main.log",
  mainPolls: [
    [redMain, greenBefore],
    [healed, redMain, greenBefore],
  ],
})
same("a queue drop on main's failure waits for main, queues again, and lands", dropped.code, 0)
same(
  "it queues again with the queue's own command",
  dropped.asked.filter((line) => line.startsWith("pr merge")),
  ["pr merge 394 --auto --rebase"],
)

const own = await follow({
  reads: [answer({ contexts: failed })],
  prRun: { ...prRun, id: 43646212621, createdAt: "2026-11-14T22:05:19Z" },
  prLog: "pr-own-failure.log",
  mainPolls: [[redMain, greenBefore]],
  files: ["tests/browser/opacity.spec.ts"],
})
same("a failure with a test of its own is the pull request's, and the follow stops", own.code, 1)
same(
  "and main's state is not blamed",
  own.said.some((line) => line.includes("not your change")),
  false,
)
same(
  "the usual failure report is printed",
  own.said.some((line) => line.includes("tests/browser/opacity.spec.ts")),
  true,
)

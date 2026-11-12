import { enqueue, parsePull, queueLine } from "./merge-queue.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}

const answer = ({ armed = false, entry = null, state = "OPEN", merged = false, contexts = [], others = [] } = {}) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          number: 394,
          state,
          merged,
          baseRefName: "main",
          headRefOid: "d4e5f6a7b8c9",
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          isInMergeQueue: entry !== null,
          mergeQueueEntry: entry,
          autoMergeRequest: armed ? { enabledAt: "2026-11-12T10:00:00Z", mergeMethod: "REBASE" } : null,
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: contexts } } } }] },
        },
        mergeQueue: { entries: { nodes: others.map((number, at) => ({ position: at + 1, pullRequest: { number } })) } },
      },
    },
  })

const contexts = [
  { __typename: "CheckRun", name: "check (main)", conclusion: "SUCCESS", status: "COMPLETED" },
  { __typename: "CheckRun", name: "check (side)", conclusion: "FAILURE", status: "COMPLETED" },
  { __typename: "CheckRun", name: "check (pptx)", conclusion: null, status: "IN_PROGRESS" },
  { __typename: "CheckRun", name: "corpus", conclusion: "SKIPPED", status: "COMPLETED" },
  { __typename: "StatusContext", context: "legacy", state: "PENDING" },
]
const read = parsePull(answer({ contexts }))
same("checks are sorted into passed, failed and running", read.checks, {
  passed: ["check (main)", "corpus"],
  failed: ["check (side)"],
  running: ["check (pptx)", "legacy"],
})
same(
  "a pull request with no entry and no auto-merge is neither queued nor armed",
  [read.queued, read.armed],
  [false, false],
)
same("the head and base are read", [read.head, read.base, read.mergeable], ["d4e5f6a7b8c9", "main", "MERGEABLE"])

const queued = parsePull(answer({ armed: true, entry: { position: 2, state: "QUEUED" }, others: [401, 394] }))
same("a queue entry gives the position", [queued.queued, queued.position], [true, 2])
same("queue line says the position", queueLine(queued), "in the merge queue at position 2")
same(
  "armed line says the queue takes it when checks pass",
  queueLine(parsePull(answer({ armed: true }))),
  "auto-merge is armed, and the queue takes it when checks pass",
)
same(
  "an unqueued line says so plainly",
  queueLine(parsePull(answer())),
  "not in the merge queue and auto-merge is not armed",
)

const message = "the merge strategy for main is set by the merge queue"
const scripted = ({ merges, reads }) => {
  const asked = []
  let readAt = 0
  let mergeAt = 0
  return {
    asked,
    merge: (args) => {
      asked.push(args.join(" "))
      return merges[Math.min(mergeAt++, merges.length - 1)]
    },
    read: () => reads[Math.min(readAt++, reads.length - 1)],
  }
}

const stuck = scripted({
  merges: [
    { status: 0, stdout: "", stderr: `${message}\n` },
    { status: 0, stdout: "", stderr: `${message}\n` },
  ],
  reads: [answer({ others: [401] })],
})
const refused = enqueue({ merge: stuck.merge, read: stuck.read, repository: "Rickvu309/AirDesign", number: 394 })
same("pull request 394's output is not taken for a queued pull request", refused.ok, false)
same("both strategies were tried", stuck.asked, ["pr merge 394 --auto --rebase", "pr merge 394 --auto"])
if (!refused.message.includes(message) || !refused.message.includes("pull request 394")) {
  throw new Error(`the failure does not quote what gh said and name the pull request: ${refused.message}`)
}

const second = scripted({
  merges: [
    { status: 0, stdout: "", stderr: `${message}\n` },
    { status: 0, stdout: "Auto-merge enabled", stderr: "" },
  ],
  reads: [answer(), answer({ armed: true })],
})
const retried = enqueue({ merge: second.merge, read: second.read, repository: "Rickvu309/AirDesign", number: 394 })
same("the second strategy arms it", [retried.ok, retried.state.armed], [true, true])

const first = scripted({ merges: [{ status: 0, stdout: "", stderr: "" }], reads: [answer({ armed: true })] })
same(
  "a pull request armed by the first try stops there",
  [enqueue({ merge: first.merge, read: first.read, repository: "r/r", number: 1 }).ok, first.asked.length],
  [true, 1],
)
